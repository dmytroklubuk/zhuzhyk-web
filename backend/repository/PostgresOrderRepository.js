
const { createHash } = require('node:crypto');
const { ConflictError } = require('../service/errors');

class PostgresOrderRepository {
    constructor(pool) {
        this.pool = pool;
    }

    async createOrder(customer, items, idempotencyKey) {
        const client = await this.pool.connect();

        const requestHash = createHash('sha256')
            .update(JSON.stringify({ customer, items }))
            .digest('hex');

        try {
            await client.query('BEGIN');

            const keyResult = await client.query(
                `INSERT INTO public.idempotency_keys
                    (idempotency_key, request_hash)
                 VALUES ($1, $2)
                 ON CONFLICT (idempotency_key) DO NOTHING
                 RETURNING id`,
                [idempotencyKey, requestHash]
            );

            if (keyResult.rows.length === 0) {
                const existingResult = await client.query(
                    `SELECT request_hash, response
                     FROM public.idempotency_keys
                     WHERE idempotency_key = $1
                     FOR UPDATE`,
                    [idempotencyKey]
                );

                const existing = existingResult.rows[0];

                if (existing.request_hash !== requestHash) {
                    throw new ConflictError(
                        'IDEMPOTENCY_KEY_CONFLICT',
                        'Цей ключ уже використовується для іншого замовлення'
                    );
                }

                if (!existing.response) {
                    throw new Error(
                        'Не вдалося отримати результат попереднього замовлення'
                    );
                }

                await client.query('COMMIT');

                return {
                    order: existing.response,
                    replayed: true
                };
            }

            const validatedItems = [];
            let total = 0;

            for (const item of items) {
                const result = await client.query(
                    `SELECT id, name, price, stock
                     FROM public.products
                     WHERE id = $1
                         FOR UPDATE`,
                    [item.productId]
                );

                if (result.rows.length === 0) {
                    const error = new Error('Товар не знайдено');
                    error.code = 'PRODUCT_NOT_FOUND';
                    error.productId = item.productId;
                    throw error;
                }

                const product = result.rows[0];

                if (Number(product.stock) < item.quantity) {
                    const error = new Error(
                        `Недостатньо товару: ${product.name}`
                    );

                    error.code = 'INSUFFICIENT_STOCK';
                    error.productId = item.productId;

                    throw error;
                }

                const price = Number(product.price);
                const subtotal = Math.round(
                    price * item.quantity * 100
                ) / 100;

                total += subtotal;

                validatedItems.push({
                    product,
                    quantity: item.quantity,
                    price,
                    subtotal
                });
            }

            total = Math.round(total * 100) / 100;

            const orderResult = await client.query(
                `INSERT INTO public.orders
                 (customer_name, customer_phone,
                  delivery_method, total_amount)
                 VALUES ($1, $2, $3, $4)
                     RETURNING id, status, created_at`,
                [
                    customer.name,
                    customer.phone,
                    customer.deliveryMethod,
                    total
                ]
            );

            const order = orderResult.rows[0];

            for (const item of validatedItems) {
                await client.query(
                    `INSERT INTO public.order_items
                     (order_id, product_id, product_name,
                      quantity, unit_price, subtotal)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        order.id,
                        item.product.id,
                        item.product.name,
                        item.quantity,
                        item.price,
                        item.subtotal
                    ]
                );

                await client.query(
                    `UPDATE public.products
                     SET stock = stock - $1
                     WHERE id = $2`,
                    [item.quantity, item.product.id]
                );
            }

            const response = {
                id: order.id,
                status: order.status,
                createdAt: order.created_at,
                totalAmount: total
            };

            await client.query(
                `UPDATE public.idempotency_keys
                 SET response = $1::jsonb
                 WHERE idempotency_key = $2`,
                [JSON.stringify(response), idempotencyKey]
            );

            await client.query('COMMIT');

            return {
                order: response,
                replayed: false
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = PostgresOrderRepository;
