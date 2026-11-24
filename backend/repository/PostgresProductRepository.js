
class PostgresProductRepository {
    constructor(pool) {
        this.pool = pool;
    }

    async findAll() {
        const result = await this.pool.query(`
            SELECT id, name, description, price, stock,
                   "imageUrl"
            FROM public.products
            ORDER BY id
        `);

        return result.rows.map(this.normalizeProduct);
    }

    async findById(id) {
        const result = await this.pool.query(`
            SELECT id, name, description, price, stock,
                   "imageUrl"
            FROM public.products
            WHERE id = $1
        `, [id]);

        return result.rows.length
            ? this.normalizeProduct(result.rows[0])
            : null;
    }

    async findPhoto(path) {
        const { rows } = await this.pool.query(`
            SELECT photo.content_type AS "contentType", photo.data
            FROM public.product_photos photo
            JOIN public.products p ON p.id = photo.product_id AND p."imageUrl" = photo.path
            WHERE photo.path = $1
            LIMIT 1
        `, [path]);
        return rows[0];
    }

    async insert({ name, description, price, stock, imageUrl = null }, photo) {
        const { rows } = await this.pool.query(`
            WITH product AS (
                INSERT INTO public.products (name, description, price, stock, "imageUrl")
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, name, description, price, stock, "imageUrl"
            ), saved_photo AS (
                INSERT INTO public.product_photos (product_id, path, content_type, data)
                SELECT id, "imageUrl", $6, $7::bytea FROM product WHERE $7::bytea IS NOT NULL
            )
            SELECT * FROM product
        `, [name, description, price, stock, imageUrl, photo?.contentType, photo?.data]);

        return this.normalizeProduct(rows[0]);
    }

    async update(id, { name, description, price, stock }, photo, imageUrl) {
        const { rows } = await this.pool.query(`
            WITH product AS (
                UPDATE public.products
                SET name = $1, description = $2, price = $3, stock = $4,
                    "imageUrl" = COALESCE($5, "imageUrl")
                WHERE id = $6
                RETURNING id, name, description, price, stock, "imageUrl"
            ), saved_photo AS (
                INSERT INTO public.product_photos (product_id, path, content_type, data)
                SELECT id, "imageUrl", $7, $8::bytea FROM product WHERE $8::bytea IS NOT NULL
                ON CONFLICT (product_id) DO UPDATE SET
                    path = EXCLUDED.path, content_type = EXCLUDED.content_type, data = EXCLUDED.data
            )
            SELECT * FROM product
        `, [name, description, price, stock, imageUrl, id, photo?.contentType, photo?.data]);

        return rows.length ? this.normalizeProduct(rows[0]) : null;
    }

    async importPhoto(id, { path, contentType, data }) {
        const { rowCount } = await this.pool.query(`
            INSERT INTO public.product_photos (product_id, path, content_type, data)
            SELECT id, $2, $3, $4 FROM public.products WHERE id = $1 AND "imageUrl" = $2 FOR UPDATE
            ON CONFLICT (product_id) DO UPDATE SET
                path = EXCLUDED.path, content_type = EXCLUDED.content_type, data = EXCLUDED.data
            WHERE product_photos.path <> EXCLUDED.path
        `, [id, path, contentType, data]);
        return rowCount > 0;
    }

    async findPhotosToImport() {
        const { rows } = await this.pool.query(`
            SELECT p.id, p."imageUrl" AS path
            FROM public.products p
            WHERE p."imageUrl" LIKE '/uploads/products/%'
            AND NOT EXISTS (
                SELECT 1 FROM public.product_photos photo
                WHERE photo.product_id = p.id AND photo.path = p."imageUrl"
            )
        `);
        return rows;
    }

    async delete(id) {
        const result = await this.pool.query(
            'DELETE FROM public.products WHERE id = $1',
            [id]
        );

        return result.rowCount > 0;
    }

    normalizeProduct(row) {
        return {
            ...row,
            id: Number(row.id),
            price: Number(row.price)
        };
    }
}

module.exports = PostgresProductRepository;
