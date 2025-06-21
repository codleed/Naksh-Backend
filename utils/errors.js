/**
 * Custom Error Classes and Error Handling Utilities
 * Provides a centralized error handling system for the API
 */

/**
 * Base API Error class
 */
class APIError extends Error {
  constructor(message, statusCode = 500, code = null, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        ...(this.details && { details: this.details })
      }
    };
  }
}

/**
 * Validation Error - 400 Bad Request
 */
class ValidationError extends APIError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * Authentication Error - 401 Unauthorized
 */
class AuthenticationError extends APIError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * Authorization Error - 403 Forbidden
 */
class AuthorizationError extends APIError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * Not Found Error - 404 Not Found
 */
class NotFoundError extends APIError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
  }
}

/**
 * Conflict Error - 409 Conflict
 */
class ConflictError extends APIError {
  constructor(message, details = null) {
    super(message, 409, 'CONFLICT_ERROR', details);
  }
}

/**
 * Gone Error - 410 Gone
 */
class GoneError extends APIError {
  constructor(message) {
    super(message, 410, 'GONE_ERROR');
  }
}

/**
 * Rate Limit Error - 429 Too Many Requests
 */
class RateLimitError extends APIError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

/**
 * Database Error - 500 Internal Server Error
 */
class DatabaseError extends APIError {
  constructor(message = 'Database operation failed', originalError = null) {
    super(message, 500, 'DATABASE_ERROR');
    this.originalError = originalError;
  }
}

/**
 * External Service Error - 502 Bad Gateway
 */
class ExternalServiceError extends APIError {
  constructor(service, message = 'External service unavailable') {
    super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
  }
}

/**
 * Error code mappings for Prisma errors
 */
const PRISMA_ERROR_CODES = {
  P2002: 'UNIQUE_CONSTRAINT_VIOLATION',
  P2025: 'RECORD_NOT_FOUND',
  P2003: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
  P2004: 'CONSTRAINT_VIOLATION',
  P2014: 'INVALID_ID',
  P2015: 'RELATED_RECORD_NOT_FOUND',
  P2016: 'QUERY_INTERPRETATION_ERROR',
  P2017: 'RECORDS_NOT_CONNECTED',
  P2018: 'REQUIRED_CONNECTED_RECORDS_NOT_FOUND',
  P2019: 'INPUT_ERROR',
  P2020: 'VALUE_OUT_OF_RANGE',
  P2021: 'TABLE_NOT_FOUND',
  P2022: 'COLUMN_NOT_FOUND',
  P2023: 'INCONSISTENT_COLUMN_DATA',
  P2024: 'CONNECTION_POOL_TIMEOUT',
  P2025: 'OPERATION_FAILED',
  P2026: 'UNSUPPORTED_FEATURE',
  P2027: 'QUERY_ENGINE_ERROR'
};

/**
 * Transform Prisma errors to API errors
 */
const transformPrismaError = (error) => {
  const code = error.code;
  const meta = error.meta || {};

  switch (code) {
    case 'P2002':
      const target = meta.target || ['field'];
      const field = Array.isArray(target) ? target.join(', ') : target;
      return new ConflictError(
        `${field} already exists`,
        { field, constraint: 'unique' }
      );

    case 'P2025':
      return new NotFoundError('Record');

    case 'P2003':
      return new ValidationError(
        'Invalid reference to related record',
        { constraint: 'foreign_key', field: meta.field_name }
      );

    case 'P2014':
      return new ValidationError(
        'Invalid ID provided',
        { field: meta.field_name }
      );

    case 'P2016':
      return new ValidationError(
        'Query validation failed',
        { details: error.message }
      );

    case 'P2020':
      return new ValidationError(
        'Value out of range',
        { field: meta.field_name }
      );

    case 'P2021':
      return new DatabaseError('Table does not exist');

    case 'P2024':
      return new DatabaseError('Connection pool timeout');

    default:
      return new DatabaseError('Database operation failed', error);
  }
};

/**
 * Transform validation errors from libraries like Joi, Yup, etc.
 */
const transformValidationError = (error) => {
  if (error.details && Array.isArray(error.details)) {
    // Joi validation error
    const details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    return new ValidationError('Validation failed', details);
  }

  if (error.errors && Array.isArray(error.errors)) {
    // Yup validation error
    const details = error.errors.map(err => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
    return new ValidationError('Validation failed', details);
  }

  return new ValidationError(error.message);
};

/**
 * Transform Clerk authentication errors
 */
const transformClerkError = (error) => {
  if (error.status === 401) {
    return new AuthenticationError(error.message);
  }
  if (error.status === 403) {
    return new AuthorizationError(error.message);
  }
  return new APIError(error.message, error.status || 500);
};

/**
 * Transform Cloudinary errors
 */
const transformCloudinaryError = (error) => {
  if (error.http_code === 400) {
    return new ValidationError(`File upload failed: ${error.message}`);
  }
  if (error.http_code === 401) {
    return new ExternalServiceError('Cloudinary', 'Authentication failed');
  }
  if (error.http_code === 413) {
    return new ValidationError('File size too large');
  }
  return new ExternalServiceError('Cloudinary', error.message);
};

/**
 * Generic error transformer
 */
const transformError = (error) => {
  // If it's already an APIError, return as is
  if (error instanceof APIError) {
    return error;
  }

  // Prisma errors
  if (error.code && error.code.startsWith('P')) {
    return transformPrismaError(error);
  }

  // Clerk errors
  if (error.clerkError || (error.status && error.message)) {
    return transformClerkError(error);
  }

  // Cloudinary errors
  if (error.http_code) {
    return transformCloudinaryError(error);
  }

  // Validation errors (Joi, Yup, etc.)
  if (error.isJoi || error.name === 'ValidationError') {
    return transformValidationError(error);
  }

  // MongoDB/Mongoose errors
  if (error.name === 'MongoError' || error.name === 'MongooseError') {
    return new DatabaseError('Database operation failed', error);
  }

  // Generic errors
  return new APIError(
    error.message || 'An unexpected error occurred',
    500,
    'INTERNAL_ERROR'
  );
};

module.exports = {
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  GoneError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  transformError,
  transformPrismaError,
  transformValidationError,
  transformClerkError,
  transformCloudinaryError,
  PRISMA_ERROR_CODES
};