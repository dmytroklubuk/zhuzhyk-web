const { createHash, timingSafeEqual } = require('node:crypto');

const digest = value => createHash('sha256').update(value).digest();

function requireAdmin(req, res, next) {
    res.set('Cache-Control', 'no-store');

    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
        return res.status(503).json({ message: 'Адмінпанель ще не налаштовано' });
    }

    const credentials = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(req.get('Authorization') || '');
    if (!credentials || !timingSafeEqual(
        digest(Buffer.from(credentials[1], 'base64')),
        digest(`admin:${password}`)
    )) {
        return res.set('WWW-Authenticate', 'Basic realm="Zhuzhyk Admin"')
            .status(401).json({ message: 'Потрібен вхід адміністратора' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.get('X-Admin-Request') !== '1') {
        return res.status(403).json({ message: 'Відсутній заголовок запиту адміністратора' });
    }

    next();
}

module.exports = requireAdmin;
