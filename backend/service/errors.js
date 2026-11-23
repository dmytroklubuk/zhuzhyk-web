
class ValidationError extends Error {
    constructor(details) {
        super('Validation failed');
        this.name = 'ValidationError';
        this.details = details;
    }
}

class NotFoundError extends Error {
    constructor(resource, id) {
        super(`${resource} ${id} not found`);
        this.name = 'NotFoundError';
        this.resource = resource;
        this.id = id;
    }
}

class ConflictError extends Error {
    constructor(code, message, details = []) {
        super(message);
        this.name = 'ConflictError';
        this.code = code;
        this.details = details;
    }
}

module.exports = {
    ValidationError,
    NotFoundError,
    ConflictError
};
