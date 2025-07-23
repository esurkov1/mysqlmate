# MySQLMate

Продвинутая библиотека для работы с MySQL в Node.js с расширенными возможностями логирования и управления соединениями.

## Установка

```bash
npm install mysqlmate
```

## Использование

### Базовое использование

```javascript
const Database = require('mysqlmate');

const db = new Database({
  host: 'localhost',
  user: 'username',
  password: 'password',
  database: 'mydb'
});

await db.query('SELECT * FROM users');
```

### Расширенные возможности логирования

#### Отключение логирования

```javascript
// Полное отключение логирования
process.env.MYSQLMATE_LOGGING = 'disabled';
```

#### Кастомный логгер

```javascript
const myCustomLogger = {
  log: (level, message, meta) => {
    // Вая собственная логика логирования
    console.log(`${level}: ${message}`, meta);
  }
};

const db = new Database(config, myCustomLogger);
```

## Переменные окружения

- `MYSQLMATE_LOGGING`: Управление логированием
  - `disabled`: Полное отключение логирования
- `NODE_ENV`: Влияет на уровень детализации логов

## Лицензия

MIT 