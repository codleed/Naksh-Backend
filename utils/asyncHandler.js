/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors and pass them to error middleware
 */

const { transformError } = require('./errors');

/**
 * Wraps async functions to catch errors automatically
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Wrapped function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Transform the error using our error transformation system
      const transformedError = transformError(error);
      next(transformedError);
    });
  };
};

/**
 * Alternative syntax for class methods
 * @param {Object} controller - Controller object
 * @param {string} methodName - Method name to wrap
 * @returns {Function} - Wrapped method
 */
const wrapController = (controller, methodName) => {
  const originalMethod = controller[methodName];
  return asyncHandler(originalMethod.bind(controller));
};

/**
 * Wrap all methods in a controller object
 * @param {Object} controller - Controller object
 * @returns {Object} - Controller with wrapped methods
 */
const wrapAllMethods = (controller) => {
  const wrappedController = {};
  
  Object.keys(controller).forEach(key => {
    if (typeof controller[key] === 'function') {
      wrappedController[key] = asyncHandler(controller[key]);
    } else {
      wrappedController[key] = controller[key];
    }
  });
  
  return wrappedController;
};

module.exports = {
  asyncHandler,
  wrapController,
  wrapAllMethods
};