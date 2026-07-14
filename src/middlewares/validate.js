const AppError = require('../exceptions/AppError');

/**
 * Reusable middleware to validate request parameters against a Joi schema.
 * Replaces req.body or req.query with Joi-sanitized values.
 * 
 * @param {object} schema - Joi schema object
 * @param {string} source - Target request source: 'body' or 'query'
 */
const validate = (schema, source = 'body') => (req, res, next) => {
  const data = source === 'query' ? req.query : req.body;
  const { value, error } = schema.validate(data, {
    abortEarly: false,
    allowUnknown: true, // Allow unknown top-level parameters to prevent API breakages
    stripUnknown: true, // Strip out any inputs not explicitly defined in the Joi schema
  });

  if (error) {
    const validationDetails = {};
    error.details.forEach((err) => {
      validationDetails[err.path.join('.')] = err.message;
    });

    return next(new AppError(400, 'Request validation failed', true, validationDetails));
  }

  // Override request target with validated and sanitized parameters
  if (source === 'query') {
    req.query = value;
  } else {
    req.body = value;
  }
  next();
};

module.exports = validate;
