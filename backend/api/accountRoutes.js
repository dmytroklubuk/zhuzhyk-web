const express = require('express');
const { sessionAge } = require('../service/AccountService');

const cookieName = 'zhuzhyk_session';
const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
};

function sessionToken(req) {
    const cookie = req.get('Cookie')?.split(';').find(part => part.trimStart().startsWith(`${cookieName}=`));
    const token = cookie?.trim().slice(cookieName.length + 1);
    return /^[a-f0-9]{64}$/.test(token ?? '') ? token : null;
}

function clearSessionCookie(res) {
    res.clearCookie(cookieName, cookieOptions);
}

function requireAccountRequest(req, res, next) {
    if (req.get('X-Account-Request') !== '1') {
        return res.status(403).json({ message: 'Запит до кабінету відхилено.' });
    }
    next();
}

function createAccountRoutes(accountService, orderService) {
    const router = express.Router();

    router.use((req, res, next) => {
        res.set('Cache-Control', 'no-store');
        next();
    });

    async function signIn(req, res, account, status) {
        await accountService.closeSession(sessionToken(req));
        const token = await accountService.openSession(account.id);
        res.cookie(cookieName, token, { ...cookieOptions, maxAge: sessionAge });
        return res.status(status).json({ account });
    }

    router.post('/register', requireAccountRequest, async (req, res) =>
        signIn(req, res, await accountService.register(req.body), 201)
    );

    router.post('/login', requireAccountRequest, async (req, res) => {
        const account = await accountService.authenticate(req.body);
        if (!account) return res.status(401).json({ message: 'Невірна електронна адреса або пароль.' });
        return signIn(req, res, account, 200);
    });

    router.post('/logout', requireAccountRequest, async (req, res) => {
        await accountService.closeSession(sessionToken(req));
        clearSessionCookie(res);
        res.sendStatus(204);
    });

    router.get('/', async (req, res) => {
        const token = sessionToken(req);
        const account = await accountService.findSession(token);
        if (!account) {
            if (token) clearSessionCookie(res);
            return res.json({ account: null, orders: [] });
        }
        res.json({ account, orders: await orderService.listForAccount(account.id) });
    });

    return router;
}

module.exports = { createAccountRoutes, sessionToken, clearSessionCookie };
