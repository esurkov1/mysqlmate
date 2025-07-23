const Database = require('../index');

describe('MySQLMate', () => {
  let db;
  const testConfig = {
    host: 'localhost',
    user: 'test_user',
    password: 'test_password',
    database: 'test_db'
  };

  beforeEach(() => {
    db = new Database(testConfig);
  });

  afterEach(async () => {
    await db.close();
  });

  test('should create database instance', () => {
    expect(db).toBeInstanceOf(Database);
  });

  test('healthcheck should return status', async () => {
    const result = await db.healthcheck();
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('metrics');
  });

  test('query method should execute SQL', async () => {
    const mockQuery = 'SELECT 1 as test';
    const result = await db.query(mockQuery);
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
  });

  test('should prevent SQL injection', () => {
    const dangerousSql = 'SELECT * FROM users; DROP TABLE users;';
    expect(() => db.query(dangerousSql)).toThrow('Potentially dangerous SQL query detected');
  });
}); 