
const CART_KEY = 'zhuzhyk-cart';
const PENDING_ORDER_KEY = 'zhuzhyk-pending-order';

let cart = loadCart();

const cartButton = document.querySelector('.cart-button');
const cartCount = document.getElementById('cartCount');
const cartOverlay = document.getElementById('cartOverlay');
const cartPanel = document.getElementById('cartPanel');
const closeCartButton = document.getElementById('closeCart');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const checkoutButton = document.getElementById('checkoutButton');

function loadCart() {
    try {
        const saved = JSON.parse(localStorage.getItem(CART_KEY));
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}

function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}


function getIdempotencyKey(orderData) {
    const requestData = JSON.stringify(orderData);

    try {
        const saved = JSON.parse(
            sessionStorage.getItem(PENDING_ORDER_KEY)
        );

        if (
            saved &&
            saved.requestData === requestData &&
            typeof saved.key === 'string'
        ) {
            return saved.key;
        }
    } catch {
        // Створимо новий ключ, якщо збережені дані некоректні
    }

    const key = crypto.randomUUID();

    sessionStorage.setItem(
        PENDING_ORDER_KEY,
        JSON.stringify({
            key,
            requestData
        })
    );

    return key;
}


function formatCartPrice(price) {
    return new Intl.NumberFormat('uk-UA', {
        style: 'currency',
        currency: 'UAH'
    }).format(price);
}

function renderCart() {
    cartItems.replaceChildren();

    let total = 0;
    let count = 0;

    if (cart.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'Ваш кошик порожній.';
        cartItems.appendChild(empty);
    }

    cart.forEach(item => {
        const row = document.createElement('div');
        row.className = 'cart-item';

        const title = document.createElement('strong');
        title.textContent = item.name;

        const price = document.createElement('span');
        price.textContent = formatCartPrice(item.price);

        const controls = document.createElement('div');
        controls.className = 'cart-item-controls';

        const minus = document.createElement('button');
        minus.textContent = '−';
        minus.type = 'button';
        minus.addEventListener('click', () => changeQuantity(item.id, -1));

        const quantity = document.createElement('span');
        quantity.textContent = item.quantity;

        const plus = document.createElement('button');
        plus.textContent = '+';
        plus.type = 'button';
        plus.addEventListener('click', () => changeQuantity(item.id, 1));

        const remove = document.createElement('button');
        remove.textContent = 'Видалити';
        remove.type = 'button';
        remove.addEventListener('click', () => removeFromCart(item.id));

        controls.append(minus, quantity, plus, remove);
        row.append(title, price, controls);
        cartItems.appendChild(row);

        total += item.price * item.quantity;
        count += item.quantity;
    });

    cartTotal.textContent = formatCartPrice(total);
    cartCount.textContent = count;

// Активуємо оформлення, якщо кошик не порожній
    checkoutButton.disabled = cart.length === 0;
}

function addToCart(product) {
    const stock = Number(product.stock);
    const price = Number(product.price);

    if (
        !Number.isFinite(stock) ||
        stock <= 0 ||
        !Number.isFinite(price) ||
        price < 0
    ) {
        return;
    }

    const existing = cart.find(item => String(item.id) === String(product.id));

    if (existing) {
        if (existing.quantity >= stock) {
            alert('Більше товарів немає в наявності.');
            return;
        }

        existing.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price,
            stock,
            quantity: 1
        });
    }

    saveCart();
    renderCart();
}

function changeQuantity(id, difference) {
    const item = cart.find(item => String(item.id) === String(id));
    if (!item) return;

    const next = item.quantity + difference;

    if (next <= 0) {
        removeFromCart(id);
        return;
    }

    if (next > item.stock) {
        alert('Недостатньо товару на складі.');
        return;
    }

    item.quantity = next;
    saveCart();
    renderCart();
}

function removeFromCart(id) {
    cart = cart.filter(item => String(item.id) !== String(id));
    saveCart();
    renderCart();
}

function openCart() {
    cartOverlay.hidden = false;
    cartPanel.hidden = false;
}

function closeCart() {
    cartOverlay.hidden = true;
    cartPanel.hidden = true;
}

cartButton.addEventListener('click', openCart);
closeCartButton.addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);

renderCart();

window.addToCart = addToCart;


const checkoutContainer = document.getElementById('checkoutFormContainer');
const cancelCheckoutButton = document.getElementById('cancelCheckoutButton');
const cartItemsContainer = document.getElementById('cartItems');
const cartFooter = document.querySelector('.cart-footer');

function showCheckoutForm() {
    if (!checkoutContainer || !cartItemsContainer || !cartFooter) {
        return;
    }

    cartItemsContainer.hidden = true;
    cartFooter.hidden = true;
    checkoutContainer.hidden = false;
}

function hideCheckoutForm() {
    if (!checkoutContainer || !cartItemsContainer || !cartFooter) {
        return;
    }

    checkoutContainer.hidden = true;
    cartItemsContainer.hidden = false;
    cartFooter.hidden = false;
}

checkoutButton?.addEventListener('click', showCheckoutForm);
cancelCheckoutButton?.addEventListener('click', hideCheckoutForm);


const checkoutForm = document.getElementById('checkoutForm');
const customerName = document.getElementById('customerName');
const customerPhone = document.getElementById('customerPhone');
const deliveryMethod = document.getElementById('deliveryMethod');
const submitOrderButton = document.getElementById('submitOrderButton');
const checkoutMessage = document.getElementById('checkoutMessage');

function updateSubmitButton() {
    submitOrderButton.disabled =
        cart.length === 0 || !checkoutForm.checkValidity();
}

checkoutForm.addEventListener('input', updateSubmitButton);
checkoutForm.addEventListener('change', updateSubmitButton);


checkoutForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (cart.length === 0 || !checkoutForm.checkValidity()) {
        updateSubmitButton();
        return;
    }

    submitOrderButton.disabled = true;
    checkoutMessage.textContent = 'Відправляємо замовлення...';

    const orderData = {
        customer: {
            name: customerName.value.trim(),
            phone: customerPhone.value.trim(),
            deliveryMethod: deliveryMethod.value
        },
        items: cart.map(item => ({
            productId: item.id,
            quantity: item.quantity
        }))
    };

    try {
        const idempotencyKey = getIdempotencyKey(orderData);

        const response = await fetch('/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': idempotencyKey
            },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (!response.ok) {
            const error = new Error(
                result.details?.[0]?.message ||
                result.error ||
                'Не вдалося оформити замовлення'
            );

            error.code = result.code;
            throw error;
        }

        checkoutMessage.textContent =
            `Замовлення №${result.order.id} успішно створено!`;

        const accountLink = document.createElement('a');
        accountLink.href = '/account';
        accountLink.textContent = ' Особистий кабінет';
        checkoutMessage.append(accountLink);

        sessionStorage.removeItem(PENDING_ORDER_KEY);

        cart = [];
        saveCart();
        renderCart();

        checkoutForm.reset();
        submitOrderButton.disabled = true;

    } catch (error) {
        checkoutMessage.textContent = error.message;

        if (
            error.code === 'VALIDATION_FAILED' ||
            error.code === 'INSUFFICIENT_STOCK' ||
            error.code === 'PRODUCT_NOT_FOUND' ||
            error.code === 'IDEMPOTENCY_KEY_CONFLICT'
        ) {
            sessionStorage.removeItem(PENDING_ORDER_KEY);
        }

        updateSubmitButton();
    }
});


updateSubmitButton();
