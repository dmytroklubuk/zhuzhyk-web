class PostgresAccountRepository {
    constructor(pool) {
        this.pool = pool;
    }

    async create({ email, name, passwordHash }) {
        const { rows } = await this.pool.query(
            `INSERT INTO public.customer_accounts (email, name, password_hash)
             VALUES ($1, $2, $3)
             ON CONFLICT (email) DO NOTHING
             RETURNING id, email, name`, [email, name, passwordHash]
        );
        return rows[0];
    }

    async findByEmail(email) {
        const { rows } = await this.pool.query(
            `SELECT id, email, name, password_hash AS "passwordHash"
             FROM public.customer_accounts WHERE email = $1`, [email]
        );
        return rows[0];
    }

    async createSession(tokenHash, accountId, expiresAt) {
        await this.pool.query('DELETE FROM public.customer_sessions WHERE expires_at <= NOW()');
        await this.pool.query(
            `INSERT INTO public.customer_sessions (token_hash, account_id, expires_at)
             VALUES ($1, $2, $3)`, [tokenHash, accountId, expiresAt]
        );
    }

    async findSession(tokenHash) {
        const { rows } = await this.pool.query(
            `SELECT a.id, a.email, a.name
             FROM public.customer_sessions s
             JOIN public.customer_accounts a ON a.id = s.account_id
             WHERE s.token_hash = $1 AND s.expires_at > NOW()`, [tokenHash]
        );
        return rows[0];
    }

    async deleteSession(tokenHash) {
        await this.pool.query('DELETE FROM public.customer_sessions WHERE token_hash = $1', [tokenHash]);
    }
}

module.exports = PostgresAccountRepository;
