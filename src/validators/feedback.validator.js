const Joi = require('joi');

const createFeedbackSchema = Joi.object({
  restaurantId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required(),
  customerName: Joi.string().max(100).optional().trim().allow('', null),
  customerMobile: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional()
    .trim()
    .allow('', null),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(1000).optional().trim().allow('', null),
  orderId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .allow(null),
  isComplaint: Joi.boolean().optional(),
});

const resolveComplaintSchema = Joi.object({
  status: Joi.string().valid('resolved', 'ignored').required(),
  resolutionNotes: Joi.string().min(5).max(1000).required().trim(),
});

module.exports = {
  createFeedbackSchema,
  resolveComplaintSchema,
};
