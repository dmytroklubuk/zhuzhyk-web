
const express = require('express');
const path = require('path');

const createOrderRoutes = require('./api/orderRoutes');
const createProductRoutes = require('./api/productRoutes');
const { errorHandler, notFoundHandler } = require('./api/errorHandler');

const requireAdmin = require('./middleware/requireAdmin');
const requestId = require('./middleware/requestId');
const rateLimiter = require('./middleware/rateLimiter');
const { metricsMiddleware, metricsHandler } = require('./middleware/metrics');

function createApp({ productService, orderService }) {
    const app = express();

    app.use(metricsMiddleware);
    app.get('/metrics', metricsHandler);

    // Додаємо унікальний ID до кожного HTTP-запиту
    app.use(requestId);

    // Обмежуємо кількість запитів
    app.use(rateLimiter);

    // Дозволяємо серверу приймати JSON
    app.use(express.json());

    // Віддаємо HTML, CSS та JavaScript клієнту
    app.use(express.static(path.join(__dirname, '../frontend/public')));

    // Віддаємо фотографії товарів
    app.use(
        '/uploads',
        express.static(path.join(__dirname, 'uploads'))
    );

    // Перевірка працездатності сервера
   app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok'
    });
});

    app.get('/admin', requireAdmin, (req, res) => {
        res.sendFile(path.join(__dirname, 'views/admin.html'));
    });

    // CRUD API для товарів
    app.use('/items', createProductRoutes(productService));
    app.use('/orders', createOrderRoutes(orderService));

    // Обробка неіснуючих маршрутів
    app.use(notFoundHandler);

    // Централізована обробка помилок
    app.use(errorHandler);

    return app;
}

module.exports = createApp;
