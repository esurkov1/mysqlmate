# MySQLMate

[![npm version](https://badge.fury.io/js/mysqlmate.svg)](https://badge.fury.io/js/mysqlmate)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> A powerful and production-ready MySQL wrapper for Node.js applications

## Overview

MySQLMate is a robust Node.js library that simplifies MySQL database operations while providing enterprise-grade features like automatic retry logic, connection pooling, built-in metrics, structured logging with Pino, graceful shutdown handling, and transaction management. It abstracts away low-level MySQL complexities while maintaining full control over query execution, making it perfect for microservices, web applications, and data-intensive applications that require reliable database connectivity.

## Features

- **Automatic retry mechanism** with configurable backoff strategy
- **Built-in connection pooling** with health monitoring
- **Structured logging** with Pino (development and production modes)
- **Transaction management** with automatic rollback on errors
- **Query metrics** and performance tracking
- **SQL injection protection** with basic validation
- **Migration support** with automatic tracking
- **Graceful shutdown** with active operation tracking and timeout
- **Multi-query execution** with error handling
- **Health check endpoints** for monitoring systems
- **Automatic process signal handling** (SIGTERM, SIGINT, SIGHUP)

## Installation

```bash
npm install mysqlmate
```

## Quick Start

```javascript
const MySQLMate = require('mysqlmate');

// Create instance with basic configuration
const db = new MySQLMate({
  host: 'localhost',
  user: 'username',
  password: 'password',
  database: 'mydb'
});

// Execute query
const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [123]);
console.log(rows);

// Execute transaction
const result = await db.transaction(async (connection) => {
  const [user] = await connection.execute('INSERT INTO users SET ?', [userData]);
  await connection.execute('INSERT INTO user_profiles SET user_id = ?, ?', [user.insertId, profileData]);
  return user;
});

// Graceful shutdown (automatic on SIGTERM/SIGINT)
process.on('SIGTERM', async () => {
  await db.gracefulShutdown();
  process.exit(0);
});
```

## Configuration Options

### Basic Configuration
```javascript
const db = new MySQLMate({
  host: 'localhost',          // MySQL host
  port: 3306,                 // MySQL port (default: 3306)
  user: 'username',           // Database user
  password: 'password',       // Database password
  database: 'mydb',           // Database name
  connectionLimit: 10         // Connection pool limit
});
```

### Advanced Configuration
```javascript
const db = new MySQLMate({
  // Database connection
  host: 'localhost',
  user: 'username',
  password: 'password',
  database: 'mydb',
  port: 3306,
  connectionLimit: 10,
  
  // Connection settings
  connectTimeout: 15000,      // Connection timeout (default: 10000ms)
  acquireTimeout: 10000,      // Pool acquire timeout
  timeout: 20000,             // Query timeout
  
  // Retry settings
  maxRetries: 5,              // Max retry attempts (default: 3)
  retryDelay: 2000,           // Initial retry delay (default: 1000ms)
  backoffMultiplier: 2,       // Backoff multiplier (default: 2)
  
  // Logger configuration
  logger: {
    title: 'MyApp',           // Logger name (default: 'MySQLMate')
    level: 'info',            // Log level (default: 'info')
    isDev: false              // Use JSON format for production (default: true)
  }
});
```

## API Reference

### Constructor
```javascript
new MySQLMate(config)
```

**Parameters:**
- `config` (object) - Single configuration object containing database connection settings and options

### Core Methods

#### `query(sql, params, options)`
Executes a SQL query with automatic retry logic.

```javascript
// Simple query
const [rows] = await db.query('SELECT * FROM users');

// Parameterized query
const [rows] = await db.query('SELECT * FROM users WHERE age > ?', [18]);

// Query with options
const [rows] = await db.query('SELECT * FROM users', [], { 
  maxRetries: 1,
  logQuery: true 
});
```

#### `transaction(callback)`
Executes multiple queries in a transaction with automatic rollback on errors.

```javascript
const result = await db.transaction(async (connection) => {
  const [user] = await connection.execute('INSERT INTO users SET ?', [userData]);
  await connection.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, accountId]);
  return user;
});
```

#### `multiQuery(queries)`
Executes multiple queries with error tracking.

```javascript
const queries = [
  { sql: 'SELECT COUNT(*) as users FROM users' },
  { sql: 'SELECT COUNT(*) as orders FROM orders' },
  { sql: 'SELECT * FROM settings WHERE key = ?', params: ['app_version'] }
];

const results = await db.multiQuery(queries);
```

#### `runMigration(migrationSql)`
Executes database migrations with automatic tracking.

```javascript
const migrationSql = `
  CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2)
  )
`;

const result = await db.runMigration(migrationSql);
console.log(result.executed); // true if migration was run
```

#### `getConnection()`
Gets a connection from the pool for manual management.

```javascript
const connection = await db.getConnection();
try {
  const [rows] = await connection.execute('SELECT * FROM users');
} finally {
  connection.release();
}
```

#### `healthcheck()`
Returns health status and performance metrics.

```javascript
const health = await db.healthcheck();
console.log(health.status); // 'healthy' or 'unhealthy'
console.log(health.metrics);
```

#### `getMetrics()`
Returns detailed performance and connection metrics.

```javascript
const metrics = db.getMetrics();
console.log({
  totalQueries: metrics.totalQueries,
  failedQueries: metrics.failedQueries,
  avgQueryTime: metrics.avgQueryTime,
  activeConnections: metrics.activeConnections
});
```

#### `gracefulShutdown(timeout)`
Performs graceful shutdown, waiting for active operations to complete.

```javascript
// Graceful shutdown with 15 second timeout
await db.gracefulShutdown(15000);

// Default timeout is 10 seconds
await db.gracefulShutdown();
```

#### `close()`
Immediately closes all connections and cleans up resources.

```javascript
await db.close();
```

## Graceful Shutdown

MySQLMate provides robust graceful shutdown functionality with automatic process signal handling:

### Automatic Process Handling
MySQLMate automatically sets up handlers for common process signals:

```javascript
const db = new MySQLMate({ /* config */ });
// SIGTERM, SIGINT, and SIGHUP are automatically handled
// No additional setup required
```

### Manual Graceful Shutdown
```javascript
// Manual graceful shutdown with timeout
await db.gracefulShutdown(15000); // 15 second timeout

// The shutdown process:
// 1. Sets isShuttingDown flag to prevent new operations
// 2. Waits for active queries/transactions to complete
// 3. Closes the connection pool
// 4. Logs completion status
```

### Active Operation Tracking
```javascript
// MySQLMate tracks all active operations
console.log(db.activeOperations.size); // Number of active operations
console.log(db.isShuttingDown);        // Shutdown state
```

### Shutdown Behavior
During graceful shutdown:
- **New operations are rejected** with descriptive error messages
- **Active operations continue** until completion or timeout
- **Detailed logging** shows shutdown progress and any timeouts
- **Automatic cleanup** ensures no resource leaks

## Logger Configuration

MySQLMate uses Pino for structured logging with configurable output formats:

- **title** (string): Name displayed in logs (default: 'MySQLMate')
- **level** (string): Logging level - 'trace', 'debug', 'info', 'warn', 'error', 'fatal' (default: 'info')
- **isDev** (boolean): 
  - `true`: Uses pino-pretty for colored, human-readable output (development)
  - `false`: Uses JSON format for structured logging (production)

```javascript
const db = new MySQLMate({
  host: 'localhost',
  user: 'username',
  password: 'password',
  database: 'mydb',
  logger: {
    title: 'DatabaseService',
    level: 'debug',
    isDev: process.env.NODE_ENV !== 'production'
  }
});
```

## Examples

### Express.js Application with Graceful Shutdown
```javascript
const express = require('express');
const MySQLMate = require('mysqlmate');

const app = express();
const db = new MySQLMate({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  logger: {
    title: 'WebAPI',
    level: process.env.LOG_LEVEL || 'info',
    isDev: process.env.NODE_ENV !== 'production'
  }
});

// Get users endpoint
app.get('/users', async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, name, email FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create user endpoint
app.post('/users', async (req, res) => {
  try {
    const result = await db.transaction(async (connection) => {
      const [user] = await connection.execute(
        'INSERT INTO users (name, email) VALUES (?, ?)',
        [req.body.name, req.body.email]
      );
      return { id: user.insertId, ...req.body };
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = await db.healthcheck();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

const server = app.listen(3000);

// Graceful shutdown handling (automatic via MySQLMate + manual server shutdown)
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  server.close();
  // MySQLMate handles its own shutdown automatically
});
```

### Microservice with Custom Graceful Shutdown
```javascript
const MySQLMate = require('mysqlmate');

const db = new MySQLMate({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  maxRetries: 5,
  retryDelay: 2000,
  logger: {
    title: 'OrderService',
    level: 'info',
    isDev: false
  }
});

// Custom graceful shutdown with additional cleanup
const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}, starting graceful shutdown...`);
  
  // Your custom cleanup logic
  await cleanup();
  
  // MySQLMate graceful shutdown (with custom timeout)
  await db.gracefulShutdown(20000);
  
  console.log('Graceful shutdown completed');
  process.exit(0);
};

// Override automatic handlers if you need custom logic
process.removeAllListeners('SIGTERM');
process.removeAllListeners('SIGINT');
['SIGTERM', 'SIGINT'].forEach(signal => {
  process.on(signal, gracefulShutdown);
});
```

### Data Processing with Metrics and Shutdown Handling
```javascript
const db = new MySQLMate({
  host: 'localhost',
  user: 'username', 
  password: 'password',
  database: 'mydb',
  logger: { 
    level: 'debug', 
    isDev: true 
  }
});

// Process large dataset with monitoring
async function processOrders() {
  const batchSize = 1000;
  let offset = 0;
  
  while (true) {
    // Check if shutting down
    if (db.isShuttingDown) {
      console.log('Graceful shutdown initiated, stopping processing');
      break;
    }
    
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE processed = 0 LIMIT ? OFFSET ?',
      [batchSize, offset]
    );
    
    if (orders.length === 0) break;
    
    // Process orders in transaction
    await db.transaction(async (connection) => {
      for (const order of orders) {
        await connection.execute(
          'UPDATE orders SET processed = 1, processed_at = NOW() WHERE id = ?',
          [order.id]
        );
      }
    });
    
    offset += batchSize;
    
    // Log progress with metrics
    const metrics = db.getMetrics();
    console.log(`Processed ${offset} orders. Active operations: ${db.activeOperations.size}, Avg query time: ${metrics.avgQueryTime}ms`);
  }
}

// Start processing
processOrders().catch(console.error);
```

## Error Handling

MySQLMate provides comprehensive error handling with detailed logging:

```javascript
try {
  await db.query('SELECT * FROM non_existent_table');
} catch (error) {
  // Error includes:
  // - error.message: Human readable error message
  // - error.code: MySQL error code
  // - error.sql: The SQL query that failed
  // - Detailed logging with query context
}

// Graceful shutdown errors
try {
  await db.query('SELECT * FROM users');
} catch (error) {
  if (error.message.includes('shutting down')) {
    console.log('Database is shutting down, operation rejected');
  }
}
```

## Environment Variables

- `NODE_ENV`: Affects logging verbosity and format
- `MYSQLMATE_LOGGING`: Set to 'disabled' to disable all logging

## License

MIT © [Eugene Surkov](https://github.com/esurkov1)

---

**Built for the Node.js community with focus on reliability and performance** 