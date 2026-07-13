const AppError = require('../exceptions/AppError');

/**
 * Reusable middleware to validate request bodies against a Joi schema.
 * Replaces req.body with Joi-sanitized values (stripping unknown inputs).
 * 
 * @param {object} schema - Joi schema object
 */
const validate = (schema) => (req, res, next) => {
  const { value, error } = schema.validate(req.body, {
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

  // Override req.body with validated and sanitized parameters
  req.body = value;
  next();
};

module.exports = validate;
