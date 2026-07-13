const config = require('../config/env');
const AppError = require('../exceptions/AppError');
const logger = require('../utils/logger');
const { sendError } = require('../utils/response');

/**
 * Express global error handling middleware.
 */
function errorHandler(err, req, res, next) {
  let error = err;

  // Set default properties if not already set
  error.statusCode = error.statusCode || 500;
  error.message = error.message || 'Internal Server Error';
  
  // Flag system-level non-operational errors
  if (error.isOperational === undefined) {
    error.isOperational = false;
  }

  // Handle specific database/Mongoose errors
  if (error.name === 'CastError') {
    // Invalid MongoDB ObjectId
    const message = `Invalid resource identifier: ${error.value}`;
    error = new AppError(400, message, true);
  } else if (error.code === 11000) {
    // MongoDB duplicate key violation
    const fieldName = Object.keys(error.keyValue)[0];
    const message = `Duplicate value entered for field: '${fieldName}'. Please choose another.`;
    error = new AppError(409, message, true, error.keyValue);
  } else if (error.name === 'ValidationError') {
    // Mongoose schema validation failed
    const errors = Object.values(error.errors).map((el) => el.message);
    const message = `Validation failed: ${errors.join(', ')}`;
    error = new AppError(400, message, true, error.errors);
  } else if (error.name === 'JsonWebTokenError') {
    // JWT signature verification failed
    error = new AppError(401, 'Invalid authentication token. Please log in again.', true);
  } else if (error.name === 'TokenExpiredError') {
    // JWT expired
    error = new AppError(401, 'Authentication token has expired. Please log in again.', true);
  }

  // Log error using Pino
  // We log all 500 errors as ERROR, and operational errors as WARN or INFO to reduce noise
  const logPayload = {
    req: {
      method: req.method,
      url: req.originalUrl,
      requestId: req.id, // in case request ID middleware is active
    },
    err: {
      message: err.message,
      stack: err.stack,
      details: err.details,
    },
  };

  if (error.statusCode >= 500) {
    logger.error(logPayload, 'Unexpected system error');
  } else {
    logger.warn(logPayload, `Operational error: ${error.message}`);
  }

  // Send JSON response
  const isProd = config.env === 'production';
  const responseMessage = (isProd && !error.isOperational) 
    ? 'An unexpected error occurred on the server.' 
    : error.message;

  const responseErrors = !error.isOperational 
    ? (isProd ? null : { stack: error.stack })
    : (error.details || null);

  return sendError(res, error.statusCode, responseMessage, responseErrors);
}

module.exports = errorHandler;
