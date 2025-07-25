const MySQLMate = require('../index');

// Mock mysql2/promise
jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(() => ({
    execute: jest.fn().mockResolvedValue([{ test: 1 }]),
    getConnection: jest.fn().mockResolvedValue({
      execute: jest.fn().mockResolvedValue([{ test: 1 }]),
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn().mockResolvedValue()
    }),
    end: jest.fn().mockResolvedValue(),
    on: jest.fn(),
    _allConnections: [],
    _freeConnections: [],
    _usedConnections: []
  }))
}));

describe('MySQLMate', () => {
  let db;
  const testConfig = {
    host: 'localhost',
    user: 'test_user',
    password: 'test_password',
    database: 'test_db'
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    db = new MySQLMate(testConfig);
  });

  afterEach(async () => {
    await db.close();
  });

  test('should create database instance', () => {
    expect(db).toBeInstanceOf(MySQLMate);
    expect(db.logger).toBeDefined();
    expect(db.metrics).toBeDefined();
  });

  test('should create database instance with logger config', () => {
    const dbWithLogger = new MySQLMate({
      ...testConfig,
      logger: {
        title: 'TestDB',
        level: 'debug',
        isDev: false
      }
    });
    expect(dbWithLogger).toBeInstanceOf(MySQLMate);
    expect(dbWithLogger.logger).toBeDefined();
  });

  test('should create logger with default config', () => {
    expect(db.logger.info).toBeDefined();
    expect(db.logger.error).toBeDefined();
    expect(db.logger.warn).toBeDefined();
    expect(db.logger.debug).toBeDefined();
  });

  test('healthcheck should return status', async () => {
    const result = await db.healthcheck();
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('metrics');
    expect(result.status).toBe('healthy');
  });

  test('query method should execute SQL', async () => {
    const mockQuery = 'SELECT 1 as test';
    const result = await db.query(mockQuery);
    expect(result).toBeDefined();
    expect(db.metrics.totalQueries).toBe(1);
  });

  test('query method should handle parameters', async () => {
    const mockQuery = 'SELECT * FROM users WHERE id = ?';
    const params = [123];
    const result = await db.query(mockQuery, params);
    expect(result).toBeDefined();
  });

  test('transaction method should work', async () => {
    const result = await db.transaction(async (connection) => {
      const [rows] = await connection.execute('SELECT 1 as test');
      return rows;
    });
    expect(result).toBeDefined();
  });

  test('multiQuery should handle multiple queries', async () => {
    const queries = [
      { sql: 'SELECT 1 as test1' },
      { sql: 'SELECT 2 as test2' }
    ];
    const results = await db.multiQuery(queries);
    expect(results.length).toBe(2);
    expect(results[0]).toHaveProperty('index', 0);
    expect(results[1]).toHaveProperty('index', 1);
  });

  test('should validate SQL queries', () => {
    expect(() => db._validateQuery('')).toThrow('SQL query must be a non-empty string');
    expect(() => db._validateQuery(123)).toThrow('SQL query must be a non-empty string');
    expect(() => db._validateQuery('SELECT 1', 'invalid')).toThrow('Query parameters must be an array');
  });

  test('should prevent SQL injection', () => {
    const dangerousSql = 'SELECT * FROM users; DROP TABLE users;';
    expect(() => db._validateQuery(dangerousSql)).toThrow('Potentially dangerous SQL query detected');
    
    const unionSql = 'SELECT * FROM users UNION SELECT password FROM admins';
    expect(() => db._validateQuery(unionSql)).toThrow('Potentially dangerous SQL query detected');
  });

  test('getMetrics should return performance data', () => {
    const metrics = db.getMetrics();
    expect(metrics).toHaveProperty('totalQueries');
    expect(metrics).toHaveProperty('failedQueries');
    expect(metrics).toHaveProperty('avgQueryTime');
    expect(metrics).toHaveProperty('poolInfo');
  });

  test('should handle retry configuration', () => {
    const dbWithRetry = new MySQLMate({
      ...testConfig,
      maxRetries: 5,
      retryDelay: 2000,
      backoffMultiplier: 3
    });
    
    expect(dbWithRetry.retryConfig.maxRetries).toBe(5);
    expect(dbWithRetry.retryConfig.retryDelay).toBe(2000);
    expect(dbWithRetry.retryConfig.backoffMultiplier).toBe(3);
  });

  test('should handle advanced configuration options', () => {
    const dbWithAdvanced = new MySQLMate({
      host: 'localhost',
      user: 'test_user', 
      password: 'test_password',
      database: 'test_db',
      port: 3307,
      connectionLimit: 20,
      connectTimeout: 15000,
      logger: {
        title: 'CustomDB',
        level: 'warn',
        isDev: false
      }
    });
    
    expect(dbWithAdvanced.config.port).toBe(3307);
    expect(dbWithAdvanced.config.connectionLimit).toBe(20);
    expect(dbWithAdvanced.config.connectTimeout).toBe(15000);
  });
}); 