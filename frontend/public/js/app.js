
const loadButton = document.getElementById('loadItems');
const list = document.getElementById('itemsList');
const status = document.getElementById('status');
const warning = document.getElementById('warning');
const searchInput = document.getElementById('searchInput');

const form = document.getElementById('productForm');
const createButton = document.getElementById('createButton');
const createStatus = document.getElementById('createStatus');

const imageInput = document.getElementById('productImage');
const imagePreview = document.getElementById('imagePreview');

let previewUrl = null;

imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];

    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }

    imagePreview.replaceChildren();

    if (!file) {
        imagePreview.textContent =
            'Фото з’явиться тут після вибору';
        return;
    }

    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
        imageInput.value = '';
        imagePreview.textContent =
            'Дозволені лише JPG, PNG та WEBP';
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        imageInput.value = '';
        imagePreview.textContent =
            'Максимальний розмір фотографії — 5 МБ';
        return;
    }

    previewUrl = URL.createObjectURL(file);

    const image = document.createElement('img');
    image.src = previewUrl;
    image.alt = 'Попередній перегляд фотографії';

    imagePreview.appendChild(image);
});

let allItems = [];
let failures = 0;

const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

function getBackoff(attempt) {
    const base = 250 * (2 ** attempt);
    const jitter = Math.floor(Math.random() * 100);
    return base + jitter;
}

async function fetchWithResilience(url, options = {}) {
    const retries = 2;
    const timeoutMs = 1000;

    const method = (options.method || 'GET').toUpperCase();

    const idempotencyKey =
        method === 'POST'
            ? crypto.randomUUID()
            : null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();

        const headers = new Headers(options.headers || {});
        headers.set('X-Request-Id', crypto.randomUUID());

        if (idempotencyKey) {
            headers.set('Idempotency-Key', idempotencyKey);
        }

        let response;
        let networkError = null;

        const timer = setTimeout(
            () => controller.abort(),
            timeoutMs
        );

        try {
            response = await fetch(url, {
                ...options,
                method,
                headers,
                signal: controller.signal
            });
        } catch (error) {
            networkError = error;
        } finally {
            clearTimeout(timer);
        }

        if (networkError) {
            if (attempt === retries) {
                throw networkError;
            }

            await sleep(getBackoff(attempt));
            continue;
        }

        if (response.ok) {
            return response;
        }

        const retryable =
            response.status === 429 ||
            response.status >= 500;

        if (!retryable || attempt === retries) {
            throw new Error(`HTTP ${response.status}`);
        }

        let delay = getBackoff(attempt);

        if (response.status === 429) {
            const retryAfterHeader =
                response.headers.get('Retry-After');

            if (retryAfterHeader !== null) {
                const seconds = Number(retryAfterHeader);

                if (Number.isFinite(seconds) && seconds >= 0) {
                    delay = seconds * 1000;
                } else {
                    const retryDate =
                        Date.parse(retryAfterHeader);

                    if (!Number.isNaN(retryDate)) {
                        delay = Math.max(
                            0,
                            retryDate - Date.now()
                        );
                    }
                }
            }
        }

        await sleep(delay);
    }
}

function formatPrice(value) {
    const price = Number(value);

    if (!Number.isFinite(price)) {
        return 'Ціна не вказана';
    }

    return new Intl.NumberFormat('uk-UA', {
        style: 'currency',
        currency: 'UAH'
    }).format(price);
}

function createPlaceholder() {
    const placeholder = document.createElement('div');
    placeholder.className = 'product-placeholder';

    const icon = document.createElement('span');
    icon.className = 'placeholder-icon';
    icon.textContent = '📷';

    const text = document.createElement('span');
    text.textContent = 'Фото з’явиться пізніше';

    placeholder.append(icon, text);

    return placeholder;
}

function renderItems(items) {
    list.replaceChildren();

    if (!Array.isArray(items) || items.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'Товарів не знайдено.';
        list.appendChild(emptyMessage);
        return;
    }

    items.forEach(item => {
        const card = document.createElement('article');
        card.className = 'product-card';

        const imageContainer = document.createElement('div');
        imageContainer.className = 'product-image-container';

        if (
            typeof item.imageUrl === 'string' &&
            item.imageUrl.trim()
        ) {
            const image = document.createElement('img');
            image.className = 'product-image';
            image.alt = `Фото товару ${item.name}`;
            image.loading = 'lazy';

            image.addEventListener('error', () => {
                if (!image.dataset.retried) {
                    image.dataset.retried = 'true';

                    setTimeout(() => {
                        const separator = item.imageUrl.includes('?') ? '&' : '?';
                        image.src = `${item.imageUrl}${separator}retry=${Date.now()}`;
                    }, 500);

                    return;
                }

                imageContainer.replaceChildren(
                    createPlaceholder()
                );
            });

            imageContainer.appendChild(image);
            image.src = item.imageUrl;
        } else {
            imageContainer.appendChild(createPlaceholder());
        }

        const info = document.createElement('div');
        info.className = 'product-info';

        const title = document.createElement('h3');
        title.textContent = item.name;

        const description = document.createElement('p');
        description.className = 'product-description';
        description.textContent =
            item.description || 'Опис товару поки відсутній.';

        const price = document.createElement('div');
        price.className = 'product-price';
        price.textContent = formatPrice(item.price);

        const stock = document.createElement('p');
        stock.className = 'product-stock';

        const stockCount = Number(item.stock);

        stock.textContent =
            stockCount > 0
                ? `В наявності: ${stockCount} шт.`
                : 'Немає в наявності';


        const button = document.createElement('button');
        button.className = 'product-button';
        button.type = 'button';
        button.textContent = 'Додати до кошика';

        button.disabled = Number(item.stock) <= 0;

        button.addEventListener('click', () => {
            window.addToCart(item);
            button.textContent = '✓ Додано!';

            setTimeout(() => {
                button.textContent = 'Додати до кошика';
            }, 1200);
        });


        info.append(
            title,
            description,
            price,
            stock,
            button
        );

        card.append(imageContainer, info);
        list.appendChild(card);
    });
}

function filterItems() {
    const query = searchInput.value.trim().toLowerCase();

    const filteredItems = allItems.filter(item => {
        const name = String(item.name || '').toLowerCase();
        const description =
            String(item.description || '').toLowerCase();

        return (
            name.includes(query) ||
            description.includes(query)
        );
    });

    renderItems(filteredItems);
}

async function loadItems() {
    loadButton.disabled = true;
    status.textContent = 'Завантаження товарів...';

    try {
        const response = await fetchWithResilience('/items');
        const items = await response.json();

        if (!Array.isArray(items)) {
            throw new Error('Некоректна відповідь сервера');
        }

        allItems = items;

        filterItems();

        failures = 0;
        warning.style.display = 'none';

        status.textContent =
            `Каталог завантажено. Усього товарів: ${items.length}`;
    } catch (error) {
        failures++;

        status.textContent =
            `Помилка завантаження: ${error.message}`;

        if (failures >= 2) {
            warning.style.display = 'block';
            warning.textContent =
                '⚠️ Сервер тимчасово недоступний. ' +
                'Показано останні завантажені товари.';
        }
    } finally {
        loadButton.disabled = false;
    }
}


async function createProduct(event) {
    event.preventDefault();

    const name = document.getElementById('productName').value.trim();
    const description = document.getElementById('productDescription').value.trim();
    const price = Number(document.getElementById('productPrice').value);
    const stock = Number(document.getElementById('productStock').value);
    const file = imageInput.files[0];

    if (
        !name ||
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isInteger(stock) ||
        stock < 0
    ) {
        createStatus.textContent =
            'Перевірте правильність введених даних.';
        return;
    }

    if (file && (
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 5 * 1024 * 1024
    )) {
        createStatus.textContent =
            'Перевірте формат і розмір фотографії.';
        return;
    }

    const formData = new FormData();

    formData.append('name', name);
    formData.append('description', description);
    formData.append('price', String(price));
    formData.append('stock', String(stock));

    if (file) {
        formData.append('image', file);
    }

    createButton.disabled = true;
    createStatus.textContent = 'Створення товару...';

    try {
        const response = await fetchWithResilience('/items', {
            method: 'POST',
            body: formData
        });

        const created = await response.json();

        createStatus.textContent =
            `Товар успішно створено! ID: ${created.id}`;

        form.reset();

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }

        imagePreview.replaceChildren();

        imagePreview.textContent =
            'Фото з’явиться тут після вибору';

        await loadItems();

    } catch (error) {
        createStatus.textContent =
            `Помилка створення: ${error.message}`;
    } finally {
        createButton.disabled = false;
    }
}

loadButton.addEventListener('click', loadItems);
searchInput.addEventListener('input', filterItems);
form.addEventListener('submit', createProduct);

loadItems();
