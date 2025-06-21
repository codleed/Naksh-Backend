/**
 * Response Utilities
 * Standardized response formats for the API
 */

/**
 * Success response with data
 */
const success = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Success response for created resources
 */
const created = (res, data, message = 'Resource created successfully') => {
  return success(res, data, message, 201);
};

/**
 * Success response with no content
 */
const noContent = (res, message = 'Operation completed successfully') => {
  return res.status(204).json({
    success: true,
    message,
    timestamp: new Date().toISOString()
  });
};

/**
 * Paginated response
 */
const paginated = (res, data, pagination, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
      hasPrev: pagination.page > 1
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * Error response (used by error middleware)
 */
const error = (res, message, statusCode = 500, code = null, details = null) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      statusCode,
      ...(details && { details })
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * Validation error response
 */
const validationError = (res, errors, message = 'Validation failed') => {
  return res.status(400).json({
    success: false,
    error: {
      message,
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details: errors
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * Authentication error response
 */
const unauthorized = (res, message = 'Authentication required') => {
  return res.status(401).json({
    success: false,
    error: {
      message,
      code: 'AUTHENTICATION_ERROR',
      statusCode: 401
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * Authorization error response
 */
const forbidden = (res, message = 'Access denied') => {
  return res.status(403).json({
    success: false,
    error: {
      message,
      code: 'AUTHORIZATION_ERROR',
      statusCode: 403
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * Not found error response
 */
const notFound = (res, resource = 'Resource', message = null) => {
  return res.status(404).json({
    success: false,
    error: {
      message: message || `${resource} not found`,
      code: 'NOT_FOUND_ERROR',
      statusCode: 404
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * Conflict error response
 */
const conflict = (res, message, details = null) => {
  return res.status(409).json({
    success: false,
    error: {
      message,
      code: 'CONFLICT_ERROR',
      statusCode: 409,
      ...(details && { details })
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * Rate limit error response
 */
const rateLimited = (res, message = 'Too many requests') => {
  return res.status(429).json({
    success: false,
    error: {
      message,
      code: 'RATE_LIMIT_ERROR',
      statusCode: 429
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * Server error response
 */
const serverError = (res, message = 'Internal server error') => {
  return res.status(500).json({
    success: false,
    error: {
      message,
      code: 'INTERNAL_ERROR',
      statusCode: 500
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * Custom response with any status code
 */
const custom = (res, statusCode, data, message = null) => {
  const isSuccess = statusCode >= 200 && statusCode < 300;
  
  const response = {
    success: isSuccess,
    timestamp: new Date().toISOString()
  };
  
  if (isSuccess) {
    response.message = message || 'Success';
    response.data = data;
  } else {
    response.error = {
      message: message || 'Error',
      statusCode,
      ...(typeof data === 'object' && data !== null && { details: data })
    };
  }
  
  return res.status(statusCode).json(response);
};

/**
 * Health check response
 */
const health = (res, checks = {}) => {
  const allHealthy = Object.values(checks).every(check => check.status === 'healthy');
  const statusCode = allHealthy ? 200 : 503;
  
  return res.status(statusCode).json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks
  });
};

/**
 * API info response
 */
const apiInfo = (res, info = {}) => {
  return res.status(200).json({
    name: info.name || 'Naksh API',
    version: info.version || '1.0.0',
    description: info.description || 'Naksh Social Media Platform API',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    ...info
  });
};

/**
 * Middleware to add response helpers to res object
 */
const responseMiddleware = (req, res, next) => {
  res.success = (data, message, statusCode) => success(res, data, message, statusCode);
  res.created = (data, message) => created(res, data, message);
  res.noContent = (message) => noContent(res, message);
  res.paginated = (data, pagination, message) => paginated(res, data, pagination, message);
  res.error = (message, statusCode, code, details) => error(res, message, statusCode, code, details);
  res.validationError = (errors, message) => validationError(res, errors, message);
  res.unauthorized = (message) => unauthorized(res, message);
  res.forbidden = (message) => forbidden(res, message);
  res.notFound = (resource, message) => notFound(res, resource, message);
  res.conflict = (message, details) => conflict(res, message, details);
  res.rateLimited = (message) => rateLimited(res, message);
  res.serverError = (message) => serverError(res, message);
  res.custom = (statusCode, data, message) => custom(res, statusCode, data, message);
  res.health = (checks) => health(res, checks);
  res.apiInfo = (info) => apiInfo(res, info);
  
  next();
};

module.exports = {
  success,
  created,
  noContent,
  paginated,
  error,
  validationError,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  rateLimited,
  serverError,
  custom,
  health,
  apiInfo,
  responseMiddleware
};