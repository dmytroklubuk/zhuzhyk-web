const { createHash, randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { ValidationError, ConflictError } = require('./errors');

const deriveKey = promisify(scrypt);
const sessionAge = 7 * 24 * 60 * 60 * 1000;
const unavailablePassword = `${'0'.repeat(32)}:${'0'.repeat(128)}`;
const tokenHash = token => createHash('sha256').update(token).digest('hex');

function credentials(data) {
    const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
    const password = data?.password;
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof password !== 'string' || password.length < 10 || password.length > 128) {
        throw new ValidationError([{ field: 'credentials', message: 'Введіть коректну електронну адресу і пароль від 10 до 128 символів.' }]);
    }
    return { email, password };
}

class AccountService {
    constructor(repository) {
        this.repository = repository;
    }

    async register(data) {
        const { email, password } = credentials(data);
        const name = typeof data?.name === 'string' ? data.name.trim() : '';
        if (name.length < 2 || name.length > 100) {
            throw new ValidationError([{ field: 'name', message: 'Ім’я має містити від 2 до 100 символів.' }]);
        }

        const salt = randomBytes(16).toString('hex');
        const key = await deriveKey(password, salt, 64);
        const account = await this.repository.create({ email, name, passwordHash: `${salt}:${key.toString('hex')}` });
        if (!account) throw new ConflictError('ACCOUNT_EXISTS', 'Ця електронна адреса вже використовується.');
        return account;
    }

    async authenticate(data) {
        const { email, password } = credentials(data);
        const account = await this.repository.findByEmail(email);
        const [salt, hash] = (account?.passwordHash ?? unavailablePassword).split(':');
        const key = await deriveKey(password, salt, 64);
        if (!timingSafeEqual(key, Buffer.from(hash, 'hex')) || !account) return null;
        return { id: account.id, email: account.email, name: account.name };
    }

    async openSession(accountId) {
        const token = randomBytes(32).toString('hex');
        await this.repository.createSession(tokenHash(token), accountId, new Date(Date.now() + sessionAge));
        return token;
    }

    findSession(token) {
        return token ? this.repository.findSession(tokenHash(token)) : null;
    }

    closeSession(token) {
        return token ? this.repository.deleteSession(tokenHash(token)) : null;
    }
}

module.exports = { AccountService, sessionAge };
