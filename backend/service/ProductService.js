
const Product = require('../domain/Product');
const { ValidationError, NotFoundError } = require('./errors');
const { parseId, validateProductInput } = require('./productValidation');

function toDomain(row) {
    return new Product(
        row.id,
        row.name,
        row.description,
        row.price,
        row.stock,
        row.imageUrl ?? null
    );
}

function toDto(product) {
    return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        ...(product.imageUrl ? { imageUrl: product.imageUrl } : {})
    };
}

function toRow(product) {
    return {
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        imageUrl: product.imageUrl
    };
}

class ProductService {
    constructor(repository) {
        this.repository = repository;
    }

    async list() {
        const rows = await this.repository.findAll();

        return rows.map(row => toDto(toDomain(row)));
    }

    async get(rawId) {
        const id = parseId(rawId);
        const row = await this.repository.findById(id);

        if (!row) {
            throw new NotFoundError('Product', id);
        }

        return toDto(toDomain(row));
    }

    async create(dto, photo = null) {
        if (photo) dto = { ...dto, imageUrl: photo.path };
        const { values, details } = validateProductInput(
            dto,
            { partial: false }
        );

        if (details.length > 0) {
            throw new ValidationError(details);
        }

        const product = new Product(
            null,
            values.name,
            values.description,
            values.price,
            values.stock,
            values.imageUrl ?? null
        );

        const saved = await this.repository.insert(toRow(product), photo);

        return toDto(toDomain(saved));
    }

    async update(rawId, dto, photo = null) {
        if (photo) dto = { ...dto, imageUrl: photo.path };
        const id = parseId(rawId);
        const existing = await this.repository.findById(id);

        if (!existing) {
            throw new NotFoundError('Product', id);
        }

        const { values, details } = validateProductInput(
            dto,
            { partial: true }
        );

        if (details.length > 0) {
            throw new ValidationError(details);
        }

        const merged = new Product(
            id,
            values.name ?? existing.name,
            values.description ?? existing.description,
            values.price ?? existing.price,
            values.stock ?? existing.stock,
            values.imageUrl ?? existing.imageUrl ?? null
        );

        const saved = await this.repository.update(id, toRow(merged), photo, values.imageUrl ?? null);

        if (!saved) {
            throw new NotFoundError('Product', id);
        }

        return toDto(toDomain(saved));
    }

    findPhoto(path) {
        return this.repository.findPhoto(path);
    }

    async remove(rawId) {
        const id = parseId(rawId);

        const deleted = await this.repository.delete(id);

        if (!deleted) {
            throw new NotFoundError('Product', id);
        }
    }
}

module.exports = ProductService;
