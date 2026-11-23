import { orderCard, request, show } from './order-ui.js';

const refresh = document.querySelector('#refresh');
const orders = document.querySelector('#orders');

let busy = false;

async function load() {
    const result = await request('/admin/api/orders');
    orders.replaceChildren(...result.orders.map(order => orderCard(order, advance)));
    if (!result.orders.length) orders.textContent = 'Замовлень ще немає.';
}

async function perform(action, message) {
    if (busy) return;
    busy = true;
    refresh.disabled = true;
    orders.querySelectorAll('button').forEach(button => { button.disabled = true; });
    show('Зачекайте…');
    try {
        await action();
        show(message);
    } catch (error) {
        show(error.message, true);
    } finally {
        refresh.disabled = false;
        orders.querySelectorAll('button').forEach(button => { button.disabled = false; });
        busy = false;
    }
}

function advance(order, status) {
    perform(async () => {
        await request(`/admin/api/orders/${order.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1' },
            body: JSON.stringify({ status, deliveryMethod: order.deliveryMethod })
        });
        await load();
    }, 'Статус оновлено.');
}

refresh.addEventListener('click', () => perform(load, 'Замовлення оновлено.'));
perform(load, '');
