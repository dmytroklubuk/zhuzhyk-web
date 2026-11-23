
const express = require('express');

function createOrderRoutes(orderService) {
    const router = express.Router();

    router.post('/', async (req, res, next) => {
        try {
            const idempotencyKey = req.get('Idempotency-Key');

            const result = await orderService.createOrder(
                req.body,
                idempotencyKey
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
