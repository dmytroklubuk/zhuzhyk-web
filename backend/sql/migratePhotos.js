require('dotenv').config();

const { readFile, stat } = require('node:fs/promises');
const path = require('node:path');
const { createPostgresPool } = require('../repository/postgresDatabase');
const PostgresProductRepository = require('../repository/PostgresProductRepository');
const {
    MAX_PHOTO_BYTES, PHOTO_PREFIX, PHOTO_FILENAME, PHOTO_EXTENSIONS, detectPhotoType
} = require('../service/productPhoto');

async function readLocalPhoto(photoPath) {
    const filename = photoPath.slice(PHOTO_PREFIX.length);
    if (!PHOTO_FILENAME.test(filename)) return null;

    const file = path.join(__dirname, '../uploads/products', filename);
    try {
        const info = await stat(file);
        if (!info.isFile() || info.size > MAX_PHOTO_BYTES) return null;

        const data = await readFile(file);
        const contentType = detectPhotoType(data);
        if (!PHOTO_EXTENSIONS[contentType]?.includes(path.extname(filename).toLowerCase()) ||
            data.length > MAX_PHOTO_BYTES) return null;

        return { path: photoPath, contentType, data };
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}

async function migrate() {
    const sql = await readFile(path.join(__dirname, 'add_product_photos.sql'), 'utf8');
    const pool = createPostgresPool();
    try {
        await pool.query(sql);
        const products = new PostgresProductRepository(pool);
        const pending = await products.findPhotosToImport();

        let imported = 0;
        for (const entry of pending) {
            const photo = await readLocalPhoto(entry.path);
            if (photo && await products.importPhoto(entry.id, photo)) imported++;
        }

        console.log(`Спільне сховище готове. Перенесено фото: ${imported}.`);
        const remaining = await products.findPhotosToImport();
        if (remaining.length) {
            console.log(`Ще не перенесено: ${remaining.length}. Запустіть цю команду там, де є оригінальні файли, або завантажте фото через адмінпанель.`);
        }
    } finally {
        await pool.end();
    }
}

migrate().catch(error => {
    console.error('Не вдалося підготувати сховище фото:', error.message);
    process.exitCode = 1;
});
