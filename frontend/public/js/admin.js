const form = document.querySelector('#product-form');
const products = document.querySelector('#products');
const title = document.querySelector('#form-title');
const feedback = document.querySelector('#feedback');
const save = document.querySelector('#save');
const cancel = document.querySelector('#cancel');
const currency = new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' });

let selectedId = null;
let busy = false;

function show(message, error = false) {
    feedback.textContent = message;
    feedback.dataset.error = String(error);
}

async function request(path, options) {
    let response = await fetch(path, options);
    for (let attempt = 0; response.status === 429 && attempt < 5; attempt++) {
        const delay = Number(response.headers.get('Retry-After')) || 2;
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
        response = await fetch(path, options);
    }
    if (response.ok) return response.status === 204 ? null : response.json();

    const body = await response.json().catch(() => ({}));
    throw new Error(body.details?.[0]?.message || body.message || `Помилка HTTP ${response.status}`);
}

function edit(product) {
    selectedId = product?.id ?? null;
    form.reset();
    for (const field of ['name', 'description', 'price', 'stock']) {
        form.elements.namedItem(field).value = product?.[field] ?? '';
    }
    title.textContent = product ? 'Редагувати товар' : 'Додати товар';
    save.textContent = product ? 'Зберегти' : 'Додати товар';
    cancel.hidden = !product;
    if (product) form.elements.namedItem('name').focus();
}

async function loadProducts() {
    const items = await request('/items');
    products.replaceChildren();
    if (!items.length) {
        const cell = products.insertRow().insertCell();
        cell.colSpan = 4;
        cell.textContent = 'Каталог поки порожній.';
    }

    for (const item of items) {
        const row = products.insertRow();
        for (const value of [item.name, currency.format(item.price), item.stock]) {
            row.insertCell().textContent = value;
        }
        const actions = document.createElement('div');
        actions.className = 'actions';
        row.insertCell().append(actions);
        for (const [label, action] of [
            ['Редагувати', () => edit(item)],
            ['Видалити', () => remove(item)]
        ]) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.setAttribute('aria-label', `${label} товар ${item.name}`);
            button.toggleAttribute('data-danger', label === 'Видалити');
            button.addEventListener('click', () => { if (!busy) action(); });
            actions.append(button);
        }
    }
}

async function change(path, options, success) {
    if (busy) return;
    busy = true;
    save.disabled = true;
    cancel.disabled = true;
    show('Зачекайте…');
    try {
        await request(path, {
            ...options,
            headers: { 'X-Admin-Request': '1' }
        });
        if (options.method !== 'DELETE' || path === `/items/${selectedId}`) edit(null);
        show(success);
        try {
            await loadProducts();
        } catch (error) {
            show(`${success} Не вдалося оновити список: ${error.message}`, true);
        }
    } catch (error) {
        show(error.message, true);
    } finally {
        busy = false;
        save.disabled = false;
        cancel.disabled = false;
    }
}

function remove(product) {
    if (window.confirm(`Видалити товар «${product.name}»?`)) {
        change(`/items/${product.id}`, { method: 'DELETE' }, 'Товар видалено.');
    }
}

cancel.addEventListener('click', () => edit(null));
form.addEventListener('submit', event => {
    event.preventDefault();
    const body = new FormData(form);
    const photo = body.get('image');
    if (!photo.size) {
        body.delete('image');
    } else if (photo.size > 5 * 1024 * 1024) {
        show('Розмір фото має бути до 5 МБ.', true);
        return;
    }

    if (selectedId === null) {
        change('/items', { method: 'POST', body }, 'Товар додано.');
    } else {
        change(`/items/${selectedId}`, { method: 'PATCH', body }, 'Зміни збережено.');
    }
});

loadProducts().catch(error => show(error.message, true));
