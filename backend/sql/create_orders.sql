
CREATE TABLE IF NOT EXISTS public.orders (
                                             id BIGSERIAL PRIMARY KEY,
                                             customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    delivery_method VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'new',
    total_amount NUMERIC(12, 2) NOT NULL
    CHECK (total_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS public.order_items (
                                                  id BIGSERIAL PRIMARY KEY,
                                                  order_id BIGINT NOT NULL
                                                  REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL
    REFERENCES public.products(id),
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL
    CHECK (unit_price >= 0),
    subtotal NUMERIC(12, 2) NOT NULL
    CHECK (subtotal >= 0)
    );

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON public.order_items(order_id);
