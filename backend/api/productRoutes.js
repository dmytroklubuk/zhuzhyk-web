
const express = require('express');
const { createHash, randomUUID } = require('node:crypto');
const { PHOTO_PREFIX, PHOTO_EXTENSIONS, detectPhotoType } = require('../service/productPhoto');
const IdempotencyStore = require('../middleware/idempotencyStore');
const requireAdmin = require('../middleware/requireAdmin');
const upload = require('../middleware/uploadMiddleware');

function createProductRoutes(productService) {
    const router = express.Router();
    const idempotencyStore = new IdempotencyStore();

    function prepareProductData(req) {
        const data = { ...req.body };

        if (typeof data.price === 'string') {
            data.price = Number(data.price);
        }

        if (typeof data.stock === 'string') {
            data.stock = Number(data.stock);
        }

        return data;
    }

    function preparePhoto(file) {
        if (!file) return null;
        const contentType = detectPhotoType(file.buffer);
        if (contentType !== file.mimetype) {
            throw new Error('Дозволені лише JPG, PNG та WEBP фотографії');
        }
        return {
            path: PHOTO_PREFIX + randomUUID() + PHOTO_EXTENSIONS[contentType][0],
            data: file.buffer,
            contentType
        };
    }

    router.get('/', async (req, res, next) => {
        try {
            const products = await productService.list();

            return res.status(200).json(products);
        } catch (error) {
            next(error);
        }
    });

    router.post('/', requireAdmin, upload.single('image'), async (req, res, next) => {
        try {
            const data = prepareProductData(req);
            const photo = preparePhoto(req.file);
            if (photo) delete data.imageUrl;

            const createProduct = () => productService.create(data, photo);
            const key = req.get('Idempotency-Key');

            if (!key) {
                const product = await createProduct();

                return res.status(201)
                    .location(`/items/${product.id}`)
                    .json(product);
            }

            const idempotencyData = {
                ...data,
                uploadedFile: req.file
                    ? {
                        originalname: req.file.originalname,
                        mimetype: req.file.mimetype,
                        sha256: createHash('sha256').update(req.file.buffer).digest('hex')
                    }
                    : null
            };

            const outcome = await idempotencyStore.execute(
                key,
                idempotencyData,
                createProduct
            );

            if (outcome.conflict) {
                return res.status(409).json({
                    error: 'Conflict',
                    code: 'IDEMPOTENCY_KEY_CONFLICT',
                    requestId: req.requestId
                });
            }

            res.setHeader(
                'Idempotency-Replayed',
                String(outcome.replayed)
            );

            return res.status(201)
                .location(`/items/${outcome.result.id}`)
                .json(outcome.result);

        } catch (error) {
            next(error);
        }
    });

    router.get('/:id', async (req, res, next) => {
        try {
            const product = await productService.get(req.params.id);

            return res.status(200).json(product);
        } catch (error) {
            next(error);
        }
    });

    router.patch('/:id', requireAdmin, upload.single('image'), async (req, res, next) => {
        try {
            const data = prepareProductData(req);

            const product = await productService.update(
                req.params.id,
                data,
                preparePhoto(req.file)
            );

            return res.status(200).json(product);
        } catch (error) {
            next(error);
        }
    });

    router.delete('/:id', requireAdmin, async (req, res, next) => {
        try {
            await productService.remove(req.params.id);

            return res.status(204).end();
        } catch (error) {
            next(error);
        }
    });

    return router;
}

module.exports = createProductRoutes;
