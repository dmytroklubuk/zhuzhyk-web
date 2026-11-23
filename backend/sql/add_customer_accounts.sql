BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_accounts (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.customer_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_expiry
    ON public.customer_sessions (expires_at);

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS account_id BIGINT REFERENCES public.customer_accounts(id);

CREATE INDEX IF NOT EXISTS idx_orders_account_id
    ON public.orders (account_id, id DESC) WHERE account_id IS NOT NULL;

COMMIT;
