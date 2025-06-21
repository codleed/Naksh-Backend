/**
 * Error Handling Middleware
 * Centralized error handling for the entire application
 */

const { APIError, transformError } = require('../utils/errors');

/**
 * Development error response
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    error: {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      stack: err.stack,
      ...(err.details && { details: err.details }),
      ...(err.originalError && { originalError: err.originalError })
    }
  });
};

/**
 * Production error response
 */
const sendErrorProd = (err, res) => {
  // Only send operational errors to client in production
  if (err.isOperational) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        ...(err.details && { details: err.details })
      }
    });
  } else {
    // Log the error for debugging
    console.error('ERROR 💥:', err);
    
    // Send generic message
    res.status(500).json({
      error: {
        message: 'Something went wrong!',
        code: 'INTERNAL_ERROR'
      }
    });
  }
};

/**
 * Log error for monitoring and debugging
 */
const logError = (err, req) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.auth?.userId || req.user?.id || 'anonymous',
    error: {
      name: err.name,
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      stack: err.stack
    }
  };

  // In production, you might want to send this to a logging service
  // like Winston, Sentry, or CloudWatch
  if (err.statusCode >= 500) {
    console.error('SERVER ERROR:', JSON.stringify(errorLog, null, 2));
  } else if (err.statusCode >= 400) {
    console.warn('CLIENT ERROR:', JSON.stringify(errorLog, null, 2));
  }
};

/**
 * Main error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Transform error if it's not already an APIError
  let error = err instanceof APIError ? err : transformError(err);

  // Log the error
  logError(error, req);

  // Send appropriate response based on environment
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

/**
 * Handle unhandled routes (404)
 */
const notFoundHandler = (req, res, next) => {
  const error = new APIError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

/**
 * Handle uncaught exceptions
 */
const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.error(err.name, err.message);
    console.error(err.stack);
    process.exit(1);
  });
};

/**
 * Handle unhandled promise rejections
 */
const handleUnhandledRejection = (server) => {
  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...');
    console.error(err.name, err.message);
    console.error(err.stack);
    
    server.close(() => {
      process.exit(1);
    });
  });
};

/**
 * Graceful shutdown handler
 */
const handleGracefulShutdown = (server, prisma) => {
  const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    
    server.close(async () => {
      console.log('HTTP server closed.');
      
      try {
        await prisma.$disconnect();
        console.log('Database connection closed.');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

module.exports = {
  errorHandler,
  notFoundHandler,
  handleUncaughtException,
  handleUnhandledRejection,
  handleGracefulShutdown,
  sendErrorDev,
  sendErrorProd,
  logError
};