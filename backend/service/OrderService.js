
const {
    ValidationError,
    NotFoundError,
    ConflictError
} = require('./errors');

const statusTransitions = new Map([
    ['confirmed', { previous: 'new' }],
    ['ready', { previous: 'confirmed', delivery: 'pickup' }],
    ['shipped', { previous: 'confirmed', delivery: 'delivery' }],
    ['completed', { previous: { pickup: 'ready', delivery: 'shipped' } }]
]);

class OrderService {
    constructor(orderRepository) {
        this.orderRepository = orderRepository;
    }

    listForAccount(accountId) {
        return this.orderRepository.listOrders(accountId);
    }

    listForAdmin() {
        return this.orderRepository.listOrders(null, { admin: true });
    }

    async advanceStatus(id, { status, deliveryMethod } = {}) {
        const transition = statusTransitions.get(status);
        if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || !transition ||
            !['pickup', 'delivery'].includes(deliveryMethod)) {
            throw new ValidationError([{ field: 'status', message: 'Перевірте номер і статус замовлення.' }]);
        }

        const previous = typeof transition.previous === 'string'
            ? transition.previous
            : transition.previous[deliveryMethod];
        if ((transition.delivery && transition.delivery !== deliveryMethod) ||
            !await this.orderRepository.advanceStatus(id, status, previous, deliveryMethod)) {
            throw new ConflictError('ORDER_STATUS_CONFLICT', 'Статус уже змінився або цей перехід недоступний.');
        }
    }

    async createOrder(data, idempotencyKey, accountId = null) {
        const details = [];

        if (
            typeof idempotencyKey !== 'string' ||
            idempotencyKey.length < 16 ||
            idempotencyKey.length > 255
        ) {
            throw new ValidationError([
                {
                    field: 'idempotencyKey',
                    message: 'Некоректний ключ замовлення'
                }
            ]);
        }

        if (
            !data ||
            typeof data !== 'object' ||
            Array.isArray(data)
        ) {
            throw new ValidationError([
                {
                    field: 'body',
                    message: 'Некоректні дані замовлення'
                }
            ]);
        }

        const { customer, items } = data;

        if (
            !customer ||
            typeof customer !== 'object' ||
            Array.isArray(customer)
        ) {
            throw new ValidationError([
                {
                    field: 'customer',
                    message: 'Не вказано дані покупця'
                }
            ]);
        }

        const name = String(customer.name || '').trim();
        const phone = String(customer.phone || '').trim();
        const deliveryMethod = customer.deliveryMethod;

        if (name.length < 2 || name.length > 100) {
            details.push({
                field: 'name',
                message: "Ім'я повинно містити від 2 до 100 символів"
            });
        }

        if (!/^\+?[0-9\s()-]{9,20}$/.test(phone)) {
            details.push({
                field: 'phone',
                message: 'Некоректний номер телефону'
            });
        }

        if (!['pickup', 'delivery'].includes(deliveryMethod)) {
            details.push({
                field: 'deliveryMethod',
                message: 'Некоректний спосіб отримання'
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            details.push({
                field: 'items',
                message: 'Кошик порожній'
            });
        } else if (items.length > 100) {
            details.push({
                field: 'items',
                message: 'Забагато товарів у замовленні'
            });
        }

        if (details.length > 0) {
            throw new ValidationError(details);
        }

        const productIds = new Set();

        const validatedItems = items.map((item, index) => {
            const productId = Number(item.productId);
            const quantity = Number(item.quantity);

            if (
                !Number.isSafeInteger(productId) ||
                productId <= 0
            ) {
                details.push({
                    field: `items[${index}].productId`,
                    message: 'Некоректний ID товару'
                });
            }

            if (
                !Number.isSafeInteger(quantity) ||
                quantity < 1 ||
                quantity > 1000
            ) {
                details.push({
                    field: `items[${index}].quantity`,
                    message: 'Некоректна кількість товару'
                });
            }

            if (productIds.has(productId)) {
                details.push({
                    field: `items[${index}].productId`,
                    message: 'Товар дублюється у замовленні'
                });
            }

            productIds.add(productId);

            return { productId, quantity };
        });

        if (details.length > 0) {
            throw new ValidationError(details);
        }

        try {
            return await this.orderRepository.createOrder(
                { name, phone, deliveryMethod },
                validatedItems,
                idempotencyKey,
                accountId
            );
        } catch (error) {
            if (error.code === 'PRODUCT_NOT_FOUND') {
                throw new NotFoundError(
                    'Product',
                    error.productId
                );
            }

            if (error.code === 'INSUFFICIENT_STOCK') {
                throw new ConflictError(
                    'INSUFFICIENT_STOCK',
                    error.message
                );
            }

            throw error;
        }
    }
}

module.exports = OrderService;
