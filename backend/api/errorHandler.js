
const multer = require('multer');const {
    ValidationError,
    NotFoundError,
    ConflictError
} = require('../service/errors');

function sendError(res, status, error, code, details, retryAfter) {
    const body = {
        error,
        code,
        requestId: res.getHeader('X-Request-Id') || null
    };

    if (details) {
        body.details = details;
    }

    if (retryAfter !== undefined) {
        res.setHeader('Retry-After', retryAfter);
    }

    return res.status(status).json(body);
}

function notFoundHandler(req, res) {
    return sendError(res, 404, 'NotFound', 'ROUTE_NOT_FOUND', [
        {
            field: 'path',
            message: `Маршрут ${req.method} ${req.path} не існує`
        }
    ]);
}

function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof ValidationError) {
        return sendError(
            res, 400, 'ValidationError',
            'VALIDATION_FAILED', err.details
        );
    }

    if (err instanceof NotFoundError) {
        return sendError(
            res,
            404,
            'NotFound',
            `${err.resource.toUpperCase()}_NOT_FOUND`,
            [{
                field: 'id',
                message: `Ресурс з ID ${err.id} не знайдено`
            }]
        );
    }

    if (err instanceof ConflictError) {
        return sendError(
            res,
            409,
            'Conflict',
            err.code,
            err.details.length > 0 ? err.details : [
                {
                    field: 'items',
                    message: err.message
                }
            ]
        );
    }

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return sendError(
                res,
                413,
                'FileTooLarge',
                'FILE_TOO_LARGE',
                [{
                    field: 'image',
                    message: 'Максимальний розмір фотографії — 5 МБ'
                }]
            );
        }

        return sendError(
            res,
            400,
            'UploadError',
            'FILE_UPLOAD_FAILED',
            [{
                field: 'image',
                message: 'Не вдалося завантажити фотографію'
            }]
        );
    }

    if (
        err.message ===
        'Дозволені лише JPG, PNG та WEBP фотографії'
    ) {
        return sendError(
            res,
            400,
            'InvalidFileType',
            'INVALID_FILE_TYPE',
            [{
                field: 'image',
                message: err.message
            }]
        );
    }

    if (err.type === 'entity.parse.failed') {
        return sendError(res, 400, 'BadRequest', 'INVALID_JSON', [
            {
                field: 'body',
                message: 'Некоректний JSON'
            }
        ]);
    }

    if (err.type === 'entity.too.large') {
        return sendError(res, 413, 'BadRequest', 'PAYLOAD_TOO_LARGE');
    }

    if (
        Number.isInteger(err.status) &&
        err.status >= 400 &&
        err.status < 500
    ) {
        return sendError(res, err.status, 'BadRequest', 'BAD_REQUEST');
    }

    console.error(err);

    return sendError(
        res,
        500,
        'InternalError',
        'INTERNAL_ERROR'
    );
}

module.exports = {
    errorHandler,
    notFoundHandler
};
