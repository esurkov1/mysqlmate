# MySQLMate 🚀 MySQL Toolkit для Node.js

## 📝 Описание

MySQLMate - мощный мини-фреймворк для работы с MySQL в Node.js, предоставляющий расширенные возможности управления базами данных с фокусом на производительность, безопасность и удобство использования.

## 🌟 Ключевые преимущества

### 💡 Продвинутое управление соединениями
- Автоматический пул соединений
- Интеллектуальный retry-механизм
- Настраиваемые таймауты подключения

### 🔒 Безопасность
- Встроенная защита от SQL-инъекций
- Валидация входящих запросов
- Безопасное выполнение транзакций

### 📊 Мониторинг и метрики
- Real-time метрики производительности
- Встроенный healthcheck
- Логирование запросов

### 🚀 Расширенный функционал
- Поддержка транзакций
- Простые миграции
- Множественные параллельные запросы

## 🔧 Установка

```bash
npm install mysqlmate
```

## 💻 Быстрый старт

```javascript
const Database = require('mysqlmate');

const db = new Database({
  host: 'localhost',
  user: 'username',
  password: 'password',
  database: 'mydb'
});
```

## 📖 Полная документация

### 1. Базовые запросы `query()`

```javascript
// Простой SELECT запрос с параметрами
const [users] = await db.query(
  'SELECT * FROM users WHERE status = ?', 
  ['active']
);

// INSERT запрос
const [result] = await db.query(
  'INSERT INTO users (name, email) VALUES (?, ?)', 
  ['John Doe', 'john@example.com']
);
console.log(result.insertId);

// UPDATE запрос
await db.query(
  'UPDATE users SET last_login = NOW() WHERE id = ?', 
  [userId]
);
```

### 2. Транзакции `transaction()`

```javascript
// Безопасное выполнение нескольких связанных операций
await db.transaction(async (connection) => {
  // Списание средств
  await connection.execute(
    'UPDATE accounts SET balance = balance - ? WHERE id = ?', 
    [100, senderId]
  );
  
  // Зачисление средств
  await connection.execute(
    'UPDATE accounts SET balance = balance + ? WHERE id = ?', 
    [100, recipientId]
  );
  
  // Логирование транзакции
  await connection.execute(
    'INSERT INTO transfers (sender_id, recipient_id, amount) VALUES (?, ?, ?)', 
    [senderId, recipientId, 100]
  );
});
```

### 3. Множественные запросы `multiQuery()`

```javascript
// Выполнение нескольких независимых запросов
const results = await db.multiQuery([
  { 
    sql: 'SELECT * FROM users WHERE role = ?', 
    params: ['admin'] 
  },
  { 
    sql: 'SELECT COUNT(*) as total FROM posts', 
    params: [] 
  },
  { 
    sql: 'UPDATE stats SET last_check = NOW()', 
    params: [] 
  }
]);

// Обработка результатов
results.forEach(({ index, result }) => {
  console.log(`Результат запроса ${index}:`, result);
});
```

### 4. Healthcheck `healthcheck()`

```javascript
// Проверка состояния подключения
const healthStatus = await db.healthcheck();

// Проверка статуса
if (healthStatus.status === 'healthy') {
  console.log('Подключение к базе данных стабильно');
  console.log('Метрики:', healthStatus.metrics);
} else {
  console.error('Проблемы с подключением', healthStatus.error);
}
```

### 5. Получение метрик `getMetrics()`

```javascript
// Получение текущих метрик производительности
const metrics = db.getMetrics();

console.log('Всего запросов:', metrics.totalQueries);
console.log('Неудачных запросов:', metrics.failedQueries);
console.log('Среднее время запроса:', metrics.avgQueryTime);

// Информация о пуле соединений
console.log('Активные соединения:', metrics.poolInfo.activeConnections);
```

### 6. Миграции `runMigration()`

```javascript
// Простая миграция для создания таблицы
await db.runMigration(`
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Миграция с добавлением индекса
await db.runMigration(`
  CREATE INDEX idx_username ON users (username)
`);
```

## 🛡️ Безопасность

MySQLMate предоставляет несколько уровней защиты:
- Валидация входящих SQL-запросов
- Защита от базовых SQL-инъекций
- Настраиваемые retry-механизмы
- Безопасное управление соединениями

## 📊 Производительность

- Оптимизированное управление пулом соединений
- Автоматический retry для нестабильных соединений
- Минимальные накладные расходы

## 🤝 Contributing

Вклад в развитие проекта приветствуется! 
1. Форкните репозиторий
2. Создайте feature-branch (`git checkout -b feature/AmazingFeature`)
3. Закоммитьте изменения (`git commit -m 'Add some AmazingFeature'`)
4. Запушьте в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## 📧 Контакты

Автор: Евгений Сурков
GitHub: [@esurkov1](https://github.com/esurkov1)

## 📝 Лицензия

Распространяется под лицензией MIT. 
Смотрите `LICENSE` для дополнительной информации. 