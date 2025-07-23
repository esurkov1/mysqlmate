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
-Real-time метрики производительности
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

// Создание подключения
const db = new Database({
  host: 'localhost',
  user: 'username',
  password: 'password',
  database: 'mydb'
});

// Простой запрос
const [users] = await db.query('SELECT * FROM users WHERE active = ?', [true]);

// Транзакция
await db.transaction(async (connection) => {
  await connection.execute('INSERT INTO logs (action) VALUES (?)', ['user_login']);
  await connection.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [userId]);
});
```

## 📖 Полная документация

### Конфигурация

```javascript
const db = new Database({
  host: 'localhost',           // Хост базы данных
  user: 'username',             // Пользователь
  password: 'password',         // Пароль
  database: 'mydb',             // Имя базы данных
  
  // Дополнительные настройки
  connectTimeout: 10000,        // Время ожидания подключения (мс)
  acquireTimeout: 60000,        // Время получения соединения (мс)
  reconnect: true               // Автоматический реконнект
});
```

### Основные методы

- `query(sql, params)`: Выполнение SQL-запроса
- `transaction(callback)`: Выполнение транзакции
- `multiQuery(queries)`: Выполнение нескольких запросов
- `healthcheck()`: Проверка состояния подключения
- `getMetrics()`: Получение текущих метрик производительности

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