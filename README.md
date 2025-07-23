# MySQLMate 🚀

Продвинутая библиотека для работы с MySQL в Node.js с расширенными возможностями управления соединениями и запросами.

## 🌟 Особенности

- Пул соединений
- Retry-механизм для запросов
- Защита от SQL-инъекций
- Метрики производительности
- Healthcheck
- Простые миграции
- Транзакции
- Расширенное логирование

## 🚀 Установка

```bash
npm install mysqlmate
```

## 📖 Использование

### Базовое подключение

```javascript
const Database = require('mysqlmate');

const db = new Database({
  host: 'localhost',
  user: 'your_username',
  password: 'your_password',
  database: 'your_database'
});
```

### Выполнение запросов

```javascript
// Простой запрос
const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

// Транзакция
await db.transaction(async (connection) => {
  await connection.execute('INSERT INTO logs (action) VALUES (?)', ['user_created']);
  await connection.execute('UPDATE users SET status = ? WHERE id = ?', ['active', userId]);
});

// Множественные запросы
const results = await db.multiQuery([
  { sql: 'SELECT * FROM users', params: [] },
  { sql: 'SELECT * FROM posts', params: [] }
]);
```

### Миграции

```javascript
await db.runMigration(`
  CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY,
    name VARCHAR(255)
  )
`);
```

### Healthcheck

```javascript
const health = await db.healthcheck();
console.log(health.status, health.metrics);
```

## 🔒 Безопасность

- Базовая защита от SQL-инъекций
- Retry-механизм для нестабильных соединений
- Настраиваемые таймауты

## 📊 Метрики

```javascript
const metrics = db.getMetrics();
console.log(metrics.totalQueries, metrics.avgQueryTime);
```

## 🛠 Конфигурация

```javascript
const db = new Database({
  host: 'localhost',
  user: 'username',
  password: 'password',
  database: 'dbname',
  connectTimeout: 10000,  // Время ожидания подключения
  acquireTimeout: 60000,  // Время ожидания получения соединения
  reconnect: true         // Автоматический реконнект
});
```

## 📝 Лицензия

MIT License 