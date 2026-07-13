/**
 * Standardized API Response utilities to ensure consistent payloads across the app.
 */

/**
 * Sends a successful API response.
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Success message description
 * @param {any} data - The payload return data
 * @param {object} [pagination=null] - Optional pagination metadata
 */
function sendSuccess(res, statusCode, message, data, pagination = null) {
  const payload = {
    success: true,
    message,
    data,
  };

  if (pagination) {
    payload.pagination = pagination;
  }

  return res.status(statusCode).json(payload);
}

/**
 * Sends a failure API response.
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error description message
 * @param {any} [errors=null] - Detailed error parameters (e.g. fields validation errors)
 */
function sendError(res, statusCode, message, errors = null) {
  const payload = {
    success: false,
    message,
  };

  if (errors) {
    payload.errors = errors;
  }

  return res.status(statusCode).json(payload);
}

module.exports = {
  sendSuccess,
  sendError,
};
