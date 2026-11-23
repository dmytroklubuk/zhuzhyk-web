
const express = require('express');
const path = require('path');

const { createAccountRoutes } = require('./api/accountRoutes');
const createOrderRoutes = require('./api/orderRoutes');
const createProductRoutes = require('./api/productRoutes');
const { errorHandler, notFoundHandler } = require('./api/errorHandler');

const requireAdmin = require('./middleware/requireAdmin');
const requestId = require('./middleware/requestId');
const rateLimiter = require('./middleware/rateLimiter');
const { metricsMiddleware, metricsHandler } = require('./middleware/metrics');

function createApp({ productService, orderService, accountService }) {
    const app = express();

    app.use(metricsMiddleware);
    app.get('/metrics', metricsHandler);

    // Додаємо унікальний ID до кожного HTTP-запиту
    app.use(requestId);

    // Віддаємо HTML, CSS та JavaScript клієнту
    app.use(express.static(path.join(__dirname, '../frontend/public')));

    // Віддаємо фотографії товарів
    app.use(
        '/uploads',
        express.static(path.join(__dirname, 'uploads'))
    );

    // Обмежуємо кількість запитів
    app.use(rateLimiter);

    // Дозволяємо серверу приймати JSON
    app.use(express.json());

    // Перевірка працездатності сервера
   app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok'
    });
});

    app.get('/admin', requireAdmin, (req, res) => {
        res.sendFile(path.join(__dirname, 'views/admin.html'));
    });

    app.get('/account', (req, res) => {
        res.sendFile(path.join(__dirname, 'views/account.html'));
    });

    app.get('/admin/orders', requireAdmin, (req, res) => {
        res.sendFile(path.join(__dirname, 'views/admin-orders.html'));
    });

    app.get('/admin/api/orders', requireAdmin, async (req, res) => {
        res.json({ orders: await orderService.listForAdmin() });
    });

    app.patch('/admin/api/orders/:id', requireAdmin, async (req, res) => {
        await orderService.advanceStatus(req.params.id, req.body ?? {});
        res.sendStatus(204);
    });

    // CRUD API для товарів
    app.use('/items', createProductRoutes(productService));
    app.use('/orders', createOrderRoutes(orderService, accountService));
    app.use('/api/account', createAccountRoutes(accountService, orderService));

    // Обробка неіснуючих маршрутів
    app.use(notFoundHandler);

    // Централізована обробка помилок
    app.use(errorHandler);

    return app;
}

module.exports = createApp;
