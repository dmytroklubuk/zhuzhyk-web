CREATE TABLE IF NOT EXISTS public.product_photos (
    product_id BIGINT PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    data BYTEA NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 5242880)
);

CREATE INDEX IF NOT EXISTS idx_product_photos_path ON public.product_photos (path);
