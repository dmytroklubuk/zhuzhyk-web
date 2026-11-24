const multer = require('multer');
const path = require('node:path');
const { MAX_PHOTO_BYTES, PHOTO_EXTENSIONS } = require('../service/productPhoto');

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter(req, file, callback) {
        const extension = path.extname(file.originalname).toLowerCase();

        if (!PHOTO_EXTENSIONS[file.mimetype]?.includes(extension)) {
            return callback(new Error('Дозволені лише JPG, PNG та WEBP фотографії'));
        }

        callback(null, true);
    },
    limits: {
        fileSize: MAX_PHOTO_BYTES,
        files: 1
    }
});

module.exports = upload;
