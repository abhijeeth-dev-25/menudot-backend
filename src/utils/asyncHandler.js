/**
 * Wraps an asynchronous Express middleware/handler to catch any thrown errors
 * and pass them to the next error handling middleware automatically.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
