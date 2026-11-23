
const express = require('express');
const fs = require('fs');
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

        if (req.file) {
            data.imageUrl = `/uploads/products/${req.file.filename}`;
        }

        return data;
    }

    function removeUploadedFile(req) {
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
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
            const key = req.get('Idempotency-Key');

            if (!key) {
                const product = await productService.create(data);

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
                        size: req.file.size
                    }
                    : null
            };

            const outcome = await idempotencyStore.execute(
                key,
                idempotencyData,
                () => productService.create(data)
            );

            if (outcome.conflict) {
                removeUploadedFile(req);

                return res.status(409).json({
                    error: 'Conflict',
                    code: 'IDEMPOTENCY_KEY_CONFLICT',
                    requestId: req.requestId
                });
            }

            if (outcome.replayed) {
                removeUploadedFile(req);
            }

            res.setHeader(
                'Idempotency-Replayed',
                String(outcome.replayed)
            );

            return res.status(201)
                .location(`/items/${outcome.result.id}`)
                .json(outcome.result);

        } catch (error) {
            removeUploadedFile(req);
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
                data
            );

            return res.status(200).json(product);
        } catch (error) {
            removeUploadedFile(req);
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
