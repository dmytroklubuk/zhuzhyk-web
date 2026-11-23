import { orderCard, request, show } from './order-ui.js';

const guest = document.querySelector('#guest');
const profile = document.querySelector('#profile');
const form = document.querySelector('#account-form');
const nameField = document.querySelector('#name-field');
const password = form.elements.namedItem('password');
const submit = document.querySelector('#submit-account');
const toggle = document.querySelector('#toggle-mode');
const logout = document.querySelector('#logout');
const refresh = document.querySelector('#refresh');
const orders = document.querySelector('#orders');

let registering = false;
let busy = false;

function setMode(register) {
    registering = register;
    nameField.hidden = !register;
    const name = form.elements.namedItem('name');
    name.disabled = !register;
    name.required = register;
    password.autocomplete = register ? 'new-password' : 'current-password';
    document.querySelector('#form-title').textContent = register ? 'Створення акаунта' : 'Вхід до кабінету';
    submit.textContent = register ? 'Зареєструватися' : 'Увійти';
    toggle.textContent = register ? 'Уже маєте акаунт? Увійти' : 'Створити акаунт';
}

function render({ account, orders: history }) {
    guest.hidden = Boolean(account);
    profile.hidden = !account;
    document.querySelector('#profile-name').textContent = account?.name ?? '';
    document.querySelector('#profile-email').textContent = account?.email ?? '';
    orders.replaceChildren();
    if (!account) return;

    if (history.length) {
        orders.append(...history.map(order => orderCard(order)));
    } else {
        const empty = document.createElement('p');
        empty.textContent = 'Тут з’являться замовлення, оформлені після входу в кабінет.';
        orders.append(empty);
    }
}

async function load() {
    render(await request('/api/account'));
}

async function perform(action, message) {
    if (busy) return;
    busy = true;
    const buttons = [submit, toggle, logout, refresh];
    buttons.forEach(button => { button.disabled = true; });
    show('Зачекайте…');
    try {
        await action();
        show(message);
    } catch (error) {
        show(error.message, true);
    } finally {
        busy = false;
        buttons.forEach(button => { button.disabled = false; });
    }
}

toggle.addEventListener('click', () => {
    setMode(!registering);
    show('');
});

form.addEventListener('submit', event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    perform(async () => {
        const { account } = await request(`/api/account/${registering ? 'register' : 'login'}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Account-Request': '1' },
            body: JSON.stringify(data)
        });
        form.reset();
        render({ account, orders: [] });
        await load();
    }, '');
});

logout.addEventListener('click', () => perform(async () => {
    await request('/api/account/logout', { method: 'POST', headers: { 'X-Account-Request': '1' } });
    form.reset();
    setMode(false);
    render({ account: null, orders: [] });
}, 'Ви вийшли з кабінету.'));

refresh.addEventListener('click', () => perform(load, 'Замовлення оновлено.'));
perform(async () => {
    try {
        await load();
    } catch (error) {
        guest.hidden = false;
        throw error;
    }
}, '');
