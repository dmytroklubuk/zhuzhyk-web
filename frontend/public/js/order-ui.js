const statusLabels = new Map([
    ['new', 'Прийнято'],
    ['confirmed', 'Підтверджено'],
    ['ready', 'Готове до видачі'],
    ['shipped', 'Відправлено'],
    ['completed', 'Виконано']
]);
const currency = new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' });
const dateTime = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' });

export async function request(url, options) {
    let response = await fetch(url, options);
    for (let attempt = 0; response.status === 429 && attempt < 5; attempt++) {
        const delay = Number(response.headers.get('Retry-After')) || 2;
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
        response = await fetch(url, options);
    }

    const body = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(body?.details?.[0]?.message || body?.message || `Помилка HTTP ${response.status}`);
    }
    return body;
}

export function show(message, error = false) {
    const feedback = document.querySelector('#feedback');
    feedback.textContent = message;
    feedback.dataset.error = String(error);
}

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
}

export function orderCard(order, advance) {
    const pickup = order.deliveryMethod === 'pickup';
    const steps = ['new', 'confirmed', pickup ? 'ready' : 'shipped', 'completed'];
    const current = steps.indexOf(order.status);
    const card = element('article', '', 'order-card');
    const heading = element('div', '', 'order-heading');
    const details = element('div');
    details.append(
        element('h2', `Замовлення №${order.id}`),
        element('p', `${dateTime.format(new Date(order.createdAt))} · ${pickup ? 'Самовивіз' : 'Доставка'}`, 'order-meta')
    );
    heading.append(details, element('span', statusLabels.get(order.status) ?? order.status, 'order-status'));

    const progress = element('ol', '', 'order-progress');
    progress.setAttribute('aria-label', 'Етапи замовлення');
    for (const step of steps) {
        const item = element('li', statusLabels.get(step));
        if (step === order.status) item.setAttribute('aria-current', 'step');
        progress.append(item);
    }

    const items = element('ul', '', 'order-items');
    for (const item of order.items) {
        items.append(element('li', `${item.name} × ${item.quantity} · ${currency.format(item.subtotal)}`));
    }

    card.append(heading);
    if (advance) {
        card.append(element('p', `${order.customerName} · ${order.customerPhone}`, 'order-meta'));
    }
    card.append(progress, items, element('strong', `Разом ${currency.format(order.totalAmount)}`));

    const next = current >= 0 ? steps[current + 1] : undefined;
    if (advance && next) {
        const button = element('button', `Змінити статус на «${statusLabels.get(next)}»`, 'primary-button');
        button.type = 'button';
        button.addEventListener('click', () => advance(order, next));
        const actions = element('div');
        actions.append(button);
        card.append(actions);
    }
    return card;
}
