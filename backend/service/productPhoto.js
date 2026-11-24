const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_PREFIX = '/uploads/products/';
const PHOTO_FILENAME = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}\.(?:jpg|jpeg|png|webp)$/i;
const PHOTO_EXTENSIONS = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp']
};

function detectPhotoType(bytes) {
    if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
    if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
    if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    return null;
}

module.exports = { MAX_PHOTO_BYTES, PHOTO_PREFIX, PHOTO_FILENAME, PHOTO_EXTENSIONS, detectPhotoType };
