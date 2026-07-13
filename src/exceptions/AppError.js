/**
 * Centralized Application Error class for capturing operational exceptions.
 * Operational errors are expected issues (e.g. invalid inputs, permissions, not found).
 * Non-operational errors represent system bugs or crashes.
 */
class AppError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message summary
   * @param {boolean} [isOperational=true] - Whether the error is operational
   * @param {any} [details=null] - Extra details or sub-errors (e.g. Joi validation arrays)
   */
  constructor(statusCode, message, isOperational = true, details = null) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    // Capture stack trace, excluding this constructor call
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
