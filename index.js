const mysql = require('mysql2/promise');
const EventEmitter = require('events');
const pino = require('pino');

class MySQLMate extends EventEmitter {

    constructor(config, options = {}) {
        super();
        
        // Logger configuration
        const loggerConfig = {
            title: this.constructor.name,
            level: 'info',
            isDev: true,
            ...options.logger
        };
        
        this.logger = this.#createLogger(loggerConfig);
        
        // Extended configuration with timeouts and settings
        this.config = {
            ...config,
            connectTimeout: options.connectTimeout || 10000,
        };
        
        // Metrics
        this.metrics = {
            totalQueries: 0,
            failedQueries: 0,
            avgQueryTime: 0,
            activeConnections: 0,
            totalConnections: 0
        };
        
        // Retry settings
        this.retryConfig = {
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 1000,
            backoffMultiplier: options.backoffMultiplier || 2,
            retryableErrors: ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT']
        };
        
        // Log connection initialization
        this.logger.info({
            host: config.host,
            database: config.database,
            connectTimeout: this.config.connectTimeout
        }, 'Initializing database connection');
        
        this.pool = mysql.createPool(this.config);
        this._setupPoolEvents();
        this._healthcheckInterval = setInterval(() => this._healthcheck(), 30000);
    }

    #createLogger(config) {
        const baseOptions = {
            name: config.title,
            level: config.level
        };

        if (config.isDev) {
            return pino({
                ...baseOptions,
                transport: {
                    target: 'pino-pretty',
                    options: {
                        colorize: true,
                        translateTime: 'yyyy-mm-dd HH:MM:ss',
                        ignore: 'pid,hostname'
                    }
                }
            });
        }

        return pino(baseOptions);
    }

    _setupPoolEvents() {
        this.pool.on('connection', (connection) => {
            this.metrics.totalConnections++;
            this.metrics.activeConnections++;
            
            // Log each new connection with detailed information
            this.logger.info({
                threadId: connection.threadId,
                totalConnections: this.metrics.totalConnections,
                activeConnections: this.metrics.activeConnections
            }, 'New database connection established');
            
            this.emit('connection');
        });
        
        this.pool.on('release', (connection) => {
            this.metrics.activeConnections--;
            
            // Log connection release
            this.logger.debug({
                threadId: connection.threadId,
                activeConnections: this.metrics.activeConnections
            }, 'Database connection released');
            
            this.emit('release');
        });
    }

    // SQL query validation
    _validateQuery(sql, params) {
        if (typeof sql !== 'string' || sql.trim().length === 0) {
            throw new Error('SQL query must be a non-empty string');
        }
        
        if (params && !Array.isArray(params)) {
            throw new Error('Query parameters must be an array');
        }
        
        // Basic SQL injection protection
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

    // Enhanced query execution with retry logic
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
                    this.logger.info({ 
                        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
                        paramCount: params.length,
                        attempt: attempt + 1,
                        duration: `${duration}ms`
                    }, 'Query executed successfully');
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
                    this.logger.error({
                        sql: sql.substring(0, 100),
                        params: params.length,
                        error: error.message,
                        code: error.code,
                        attempt: attempt + 1,
                        sqlQuery: sql,
                        queryParams: params
                    }, 'Query execution failed');
                    
                    this.emit('queryError', { sql, params, error, attempt });
                    throw error;
                }
                
                const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);
                this.logger.warn({
                    error: error.message,
                    code: error.code,
                    delay: `${delay}ms`,
                    attempt: attempt + 1,
                    sqlQuery: sql,
                    queryParams: params
                }, 'Query failed, retrying');
                
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

    // Healthcheck with connection verification
    async _healthcheck() {
        try {
            await this.query('SELECT 1 as health_check', [], { skipRetry: true });
            this.emit('healthcheck', { status: 'healthy' });
        } catch (error) {
            this.logger.error({ 
                error: error.message,
                errorCode: error.code,
                errorData: error
            }, 'Healthcheck failed');
            this.emit('healthcheck', { status: 'unhealthy', error });
        }
    }

    // Public healthcheck
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

    // Get metrics
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

    // Multiple queries with error control
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
            
            this.logger.error({
                failedQueries: errors.length,
                totalQueries: queries.length,
                errors: errors.map(e => ({ index: e.index, message: e.error.message }))
            }, 'Multiple query execution had failures');
            
            throw error;
        }

        return results;
    }

    // Simple migrations
    async runMigration(migrationSql) {
        return this.transaction(async (connection) => {
            // Create migrations table if it doesn't exist
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS migrations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Generate migration name based on hash
            const migrationName = require('crypto')
                .createHash('md5')
                .update(migrationSql)
                .digest('hex');

            // Check if migration was already executed
            const [existing] = await connection.execute(
                'SELECT id FROM migrations WHERE name = ?',
                [migrationName]
            );

            if (existing.length > 0) {
                this.logger.info({ migrationName }, 'Migration already executed');
                return { executed: false, migrationName };
            }

            // Execute migration
            await connection.execute(migrationSql);
            await connection.execute(
                'INSERT INTO migrations (name) VALUES (?)',
                [migrationName]
            );

            this.logger.info({ migrationName }, 'Migration executed successfully');
            return { executed: true, migrationName };
        });
    }

    // Close connection pool with graceful shutdown  
    async close() {
        if (this._healthcheckInterval) {
            clearInterval(this._healthcheckInterval);
        }
        
        try {
            await this.pool.end();
            this.logger.info('Connection pool closed successfully');
            this.emit('close');
        } catch (error) {
            this.logger.error({ 
                error: error.message,
                errorData: error
            }, 'Failed to close connection pool');
            throw error;
        }
    }

    // Get connection
    async getConnection() {
        try {
            const connection = await this.pool.getConnection();
            this.logger.debug('Connection obtained from pool');
            return connection;
        } catch (error) {
            this.logger.error({ 
                error: error.message,
                errorData: error
            }, 'Failed to obtain connection from pool');
            throw error;
        }
    }

    // Execute transaction
    async transaction(callback) {
        const connection = await this.getConnection();

        try {
            await connection.beginTransaction();
            this.logger.debug('Transaction started');
            const result = await callback(connection);
            await connection.commit();
            this.logger.info('Transaction committed successfully');
            return result;
        } catch (error) {
            await connection.rollback();
            this.logger.error({ 
                error: error.message,
                errorData: error
            }, 'Transaction failed and rolled back');
            throw error;
        } finally {
            connection.release();
            this.logger.debug('Transaction connection released');
        }
    }
}

module.exports = MySQLMate;