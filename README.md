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
const db = new Database(config, {
  logger: {
    log: (level, message, meta) => {
      // Вая собственная логика логирования
      console.log(`${level}: ${message}`, meta);
    }
  }
});
```

#### Дополнительные настройки подключения

```javascript
const db = new Database(config, {
  logger: customLogger,  // Необязательный кастомный логгер
  connectTimeout: 15000, // Время ожидания подключения в мс
  maxRetries: 5,         // Максимальное число повторных попыток
  retryDelay: 2000,      // Задержка между повторными попытками
  backoffMultiplier: 3   // Множитель экспоненциальной задержки
});
```

## Переменные окружения

- `MYSQLMATE_LOGGING`: Управление логированием
  - `disabled`: Полное отключение логирования
- `NODE_ENV`: Влияет на уровень детализации логов

## Лицензия

MIT 