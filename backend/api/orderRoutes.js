
const express = require('express');
const { sessionToken, clearSessionCookie } = require('./accountRoutes');

function createOrderRoutes(orderService, accountService) {
    const router = express.Router();

    router.post('/', async (req, res, next) => {
        try {
            const idempotencyKey = req.get('Idempotency-Key');

            const token = sessionToken(req);
            const account = token ? await accountService.findSession(token) : null;
            if (token && !account) {
                clearSessionCookie(res);
                return res.status(401).json({
                    code: 'SESSION_EXPIRED',
                    error: 'Сеанс завершився. Увійдіть у кабінет повторно перед оформленням.'
                });
            }

            const result = await orderService.createOrder(
                req.body,
                idempotencyKey,
                account?.id
            );

            res.setHeader(
                'Idempotency-Replayed',
                String(result.replayed)
            );

            return res.status(201).json({
                message: result.replayed
                    ? 'Повернено результат попереднього замовлення'
                    : 'Замовлення успішно створено',
                order: result.order
            });
        } catch (error) {
            next(error);
        }
    });

    return router;
}

module.exports = createOrderRoutes;
