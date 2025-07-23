const mysql = require('mysql2/promise');
const EventEmitter = require('events');

class Database extends EventEmitter {
    constructor(config) {
        super();
        this.config = {
            ...config,
            connectTimeout: 10000,
            acquireTimeout: 60000,
            timeout: 60000,
            reconnect: true,
        };
        
        // Метрики
        this.metrics = {
            totalQueries: 0,
            failedQueries: 0,
            avgQueryTime: 0,
            activeConnections: 0,
            totalConnections: 0
        };
        
        // Retry настройки
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 1000,
            backoffMultiplier: 2,
            retryableErrors: ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT']
        };
        
        this.pool = mysql.createPool(this.config);
        this._setupPoolEvents();
        this._healthcheckInterval = setInterval(() => this._healthcheck(), 30000);
    }

    _setupPoolEvents() {
        this.pool.on('connection', () => {
            this.metrics.totalConnections++;
            this.metrics.activeConnections++;
            this.emit('connection');
        });
        
        this.pool.on('release', () => {
            this.metrics.activeConnections--;
            this.emit('release');
        });
    }

    // Валидация SQL запросов
    _validateQuery(sql, params) {
        if (typeof sql !== 'string' || sql.trim().length === 0) {
            throw new Error('SQL query must be a non-empty string');
        }
        
        if (params && !Array.isArray(params)) {
            throw new Error('Query parameters must be an array');
        }
        
        // Базовая защита от SQL injection
        const dangerousPatterns = [
            /;\s*(drop|delete|truncate|alter)\s+/i,
            /union\s+select/i,
            /--/,
            /\/\*/
        ];
        
        if (dangerousPatterns.some(pattern => pattern.test(sql))) {
            throw new Error('Potentially dangerous SQL query detected');
        }
    }

    // Улучшенное выполнение запроса с retry логикой
    async query(sql, params = [], options = {}) {
        this._validateQuery(sql, params);
        
        const { 
            maxRetries = this.retryConfig.maxRetries,
            skipRetry = false 
        } = options;
        
        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const start = Date.now();
            
            try {
                this.metrics.totalQueries++;
                const result = await this.pool.execute(sql, params);
                
                const duration = Date.now() - start;
                this._updateMetrics(duration);
                
                if (process.env.NODE_ENV !== 'production' || options.logQuery) {
                    console.info(`[DB] Query executed in ${duration}ms`, { 
                        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
                        paramCount: params.length,
                        attempt: attempt + 1
                    });
                }
                
                this.emit('query', { sql, params, duration, attempt });
                return result;
                
            } catch (error) {
                lastError = error;
                this.metrics.failedQueries++;
                
                const isRetryable = this.retryConfig.retryableErrors.some(
                    code => error.code === code || error.message.includes(code)
                );
                
                if (skipRetry || !isRetryable || attempt === maxRetries) {
                    console.error(`[DB] Query failed (attempt ${attempt + 1}/${maxRetries + 1})`, {
                        sql: sql.substring(0, 100),
                        params: params.length,
                        error: error.message,
                        code: error.code
                    });
                    
                    this.emit('queryError', { sql, params, error, attempt });
                    throw error;
                }
                
                const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);
                console.warn(`[DB] Query failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`, {
                    error: error.message,
                    code: error.code
                });
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }

    _updateMetrics(duration) {
        if (this.metrics.avgQueryTime === 0) {
            this.metrics.avgQueryTime = duration;
        } else {
            this.metrics.avgQueryTime = (this.metrics.avgQueryTime + duration) / 2;
        }
    }

    // Healthcheck с проверкой соединения
    async _healthcheck() {
        try {
            await this.query('SELECT 1 as health_check', [], { skipRetry: true });
            this.emit('healthcheck', { status: 'healthy' });
        } catch (error) {
            console.error('[DB] Healthcheck failed', { error: error.message });
            this.emit('healthcheck', { status: 'unhealthy', error });
        }
    }

    // Публичный healthcheck
    async healthcheck() {
        try {
            const start = Date.now();
            await this.query('SELECT 1 as health_check', [], { skipRetry: true });
            return {
                status: 'healthy',
                responseTime: Date.now() - start,
                metrics: this.getMetrics()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                metrics: this.getMetrics()
            };
        }
    }

    // Получение метрик
    getMetrics() {
        return {
            ...this.metrics,
            poolInfo: {
                totalConnections: this.pool._allConnections?.length || 0,
                freeConnections: this.pool._freeConnections?.length || 0,
                usedConnections: this.pool._usedConnections?.length || 0
            }
        };
    }

    // Множественные запросы с контролем ошибок
    async multiQuery(queries) {
        if (!Array.isArray(queries)) {
            throw new Error('Queries must be an array');
        }

        const results = [];
        const errors = [];

        for (const [index, queryData] of queries.entries()) {
            try {
                const { sql, params = [] } = queryData;
                const result = await this.query(sql, params);
                results.push({ index, result });
            } catch (error) {
                errors.push({ index, error });
            }
        }

        if (errors.length > 0) {
            const error = new Error(`${errors.length} of ${queries.length} queries failed`);
            error.results = results;
            error.errors = errors;
            throw error;
        }

        return results;
    }

    // Простые миграции
    async runMigration(migrationSql) {
        return this.transaction(async (connection) => {
            // Создаем таблицу миграций если её нет
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS migrations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Генерируем имя миграции на основе хеша
            const migrationName = require('crypto')
                .createHash('md5')
                .update(migrationSql)
                .digest('hex');

            // Проверяем, выполнялась ли миграция
            const [existing] = await connection.execute(
                'SELECT id FROM migrations WHERE name = ?',
                [migrationName]
            );

            if (existing.length > 0) {
                console.info('[DB] Migration already executed', { migrationName });
                return { executed: false, migrationName };
            }

            // Выполняем миграцию
            await connection.execute(migrationSql);
            await connection.execute(
                'INSERT INTO migrations (name) VALUES (?)',
                [migrationName]
            );

            console.info('[DB] Migration executed successfully', { migrationName });
            return { executed: true, migrationName };
        });
    }

    // Закрытие пула соединений с graceful shutdown  
    async close() {
        if (this._healthcheckInterval) {
            clearInterval(this._healthcheckInterval);
        }
        
        try {
            await this.pool.end();
            console.info('[DB] Connection pool closed successfully');
            this.emit('close');
        } catch (error) {
            console.error(`[DB] Failed to close connection pool`, { error: error.message });
            throw error;
        }
    }

    // Получение соединения
    async getConnection() {
        try {

            const connection = await this.pool.getConnection();
            console.debug('[DB] Connection obtained');
            return connection;
        } catch (error) {
            console.error(`[DB] Failed to obtain connection`, { error: error.message });
            throw error;
        }
    }

    // Выполнение транзакции
    async transaction(callback) {
        const connection = await this.getConnection();

        try {
            await connection.beginTransaction();
            console.debug('[DB] Transaction started');
            const result = await callback(connection);
            await connection.commit();
            console.info('[DB] Transaction committed successfully');
            return result;
        } catch (error) {
            await connection.rollback();
            console.error(`[DB] Transaction failed`, { error: error.message });
            throw error;
        } finally {
            connection.release();
            console.debug('[DB] Connection released');
        }
    }
}

module.exports = Database;