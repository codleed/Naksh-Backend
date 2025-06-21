/**
 * Validation Utilities
 * Common validation functions and middleware
 */

const { ValidationError } = require('./errors');

/**
 * Validate required fields
 */
const validateRequired = (data, requiredFields) => {
  const missing = [];
  
  requiredFields.forEach(field => {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(field);
    }
  });
  
  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missing.join(', ')}`,
      { missingFields: missing }
    );
  }
};

/**
 * Validate email format
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }
};

/**
 * Validate username format
 */
const validateUsername = (username) => {
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (!usernameRegex.test(username)) {
    throw new ValidationError(
      'Username must be 3-30 characters long and contain only letters, numbers, and underscores'
    );
  }
};

/**
 * Validate password strength
 */
const validatePassword = (password) => {
  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long');
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    throw new ValidationError('Password must contain at least one lowercase letter');
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    throw new ValidationError('Password must contain at least one uppercase letter');
  }
  
  if (!/(?=.*\d)/.test(password)) {
    throw new ValidationError('Password must contain at least one number');
  }
};

/**
 * Validate UUID format
 */
const validateUUID = (id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new ValidationError('Invalid ID format');
  }
};

/**
 * Validate pagination parameters
 */
const validatePagination = (page, limit) => {
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  if (isNaN(pageNum) || pageNum < 1) {
    throw new ValidationError('Page must be a positive integer');
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    throw new ValidationError('Limit must be between 1 and 100');
  }
  
  return { page: pageNum, limit: limitNum };
};

/**
 * Validate enum values
 */
const validateEnum = (value, allowedValues, fieldName) => {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `Invalid ${fieldName}. Allowed values: ${allowedValues.join(', ')}`
    );
  }
};

/**
 * Validate date format and range
 */
const validateDate = (dateString, fieldName = 'date') => {
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    throw new ValidationError(`Invalid ${fieldName} format`);
  }
  
  return date;
};

/**
 * Validate future date
 */
const validateFutureDate = (dateString, fieldName = 'date') => {
  const date = validateDate(dateString, fieldName);
  
  if (date <= new Date()) {
    throw new ValidationError(`${fieldName} must be in the future`);
  }
  
  return date;
};

/**
 * Validate file upload
 */
const validateFile = (file, options = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
    required = false
  } = options;
  
  if (!file && required) {
    throw new ValidationError('File is required');
  }
  
  if (!file) return;
  
  if (file.size > maxSize) {
    throw new ValidationError(
      `File size exceeds limit of ${maxSize / (1024 * 1024)}MB`
    );
  }
  
  if (!allowedTypes.includes(file.mimetype)) {
    throw new ValidationError(
      `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
    );
  }
};

/**
 * Validate array of items
 */
const validateArray = (array, fieldName, options = {}) => {
  const { minLength = 0, maxLength = Infinity, required = false } = options;
  
  if (!array && required) {
    throw new ValidationError(`${fieldName} is required`);
  }
  
  if (!array) return;
  
  if (!Array.isArray(array)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }
  
  if (array.length < minLength) {
    throw new ValidationError(`${fieldName} must have at least ${minLength} items`);
  }
  
  if (array.length > maxLength) {
    throw new ValidationError(`${fieldName} must have at most ${maxLength} items`);
  }
};

/**
 * Validate string length
 */
const validateStringLength = (str, fieldName, options = {}) => {
  const { minLength = 0, maxLength = Infinity, required = false } = options;
  
  if (!str && required) {
    throw new ValidationError(`${fieldName} is required`);
  }
  
  if (!str) return;
  
  if (typeof str !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }
  
  if (str.length < minLength) {
    throw new ValidationError(`${fieldName} must be at least ${minLength} characters long`);
  }
  
  if (str.length > maxLength) {
    throw new ValidationError(`${fieldName} must be at most ${maxLength} characters long`);
  }
};

/**
 * Validate coordinates
 */
const validateCoordinates = (latitude, longitude) => {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  
  if (isNaN(lat) || lat < -90 || lat > 90) {
    throw new ValidationError('Invalid latitude. Must be between -90 and 90');
  }
  
  if (isNaN(lng) || lng < -180 || lng > 180) {
    throw new ValidationError('Invalid longitude. Must be between -180 and 180');
  }
  
  return { latitude: lat, longitude: lng };
};

/**
 * Sanitize HTML content
 */
const sanitizeHtml = (html) => {
  // Basic HTML sanitization - in production, use a library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

/**
 * Validation middleware factory
 */
const createValidationMiddleware = (validationFn) => {
  return (req, res, next) => {
    try {
      validationFn(req.body, req.params, req.query);
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Common validation schemas
 */
const validationSchemas = {
  // User validation
  createUser: (body) => {
    validateRequired(body, ['username', 'email']);
    validateUsername(body.username);
    validateEmail(body.email);
    if (body.bio) validateStringLength(body.bio, 'bio', { maxLength: 500 });
  },
  
  updateUser: (body) => {
    if (body.username) validateUsername(body.username);
    if (body.email) validateEmail(body.email);
    if (body.bio) validateStringLength(body.bio, 'bio', { maxLength: 500 });
  },
  
  // Post validation
  createPost: (body) => {
    if (!body.caption && (!body.media || body.media.length === 0)) {
      throw new ValidationError('Post must have either caption or media');
    }
    
    if (body.caption) {
      validateStringLength(body.caption, 'caption', { maxLength: 2000 });
    }
    
    if (body.visibility) {
      validateEnum(body.visibility, ['PUBLIC', 'PRIVATE', 'FOLLOWERS'], 'visibility');
    }
    
    if (body.media) {
      validateArray(body.media, 'media', { maxLength: 10 });
      body.media.forEach((item, index) => {
        validateRequired(item, ['mediaUrl', 'type']);
        validateEnum(item.type, ['IMAGE', 'VIDEO'], `media[${index}].type`);
      });
    }
  },
  
  // Comment validation
  createComment: (body) => {
    validateRequired(body, ['content']);
    validateStringLength(body.content, 'content', { minLength: 1, maxLength: 1000 });
  },
  
  // Pagination validation
  pagination: (query) => {
    if (query.page || query.limit) {
      return validatePagination(query.page || 1, query.limit || 10);
    }
    return { page: 1, limit: 10 };
  }
};

module.exports = {
  validateRequired,
  validateEmail,
  validateUsername,
  validatePassword,
  validateUUID,
  validatePagination,
  validateEnum,
  validateDate,
  validateFutureDate,
  validateFile,
  validateArray,
  validateStringLength,
  validateCoordinates,
  sanitizeHtml,
  createValidationMiddleware,
  validationSchemas
};