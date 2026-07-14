const Joi = require('joi');

const configureIntegrationSchema = Joi.object({
  platform: Joi.string().valid('swiggy', 'zomato', 'magicpin').required(),
  externalRestaurantId: Joi.string().required().trim(),
  credentials: Joi.object({
    accessToken: Joi.string().required().trim(),
    refreshToken: Joi.string().optional().trim().allow(null, ''),
    expiresAt: Joi.date().optional().allow(null),
  }).required(),
  syncSettings: Joi.object({
    menuSync: Joi.boolean().optional(),
    orderSync: Joi.boolean().optional(),
    autoAcceptOrders: Joi.boolean().optional(),
  }).optional(),
});

const updateIntegrationSchema = Joi.object({
  externalRestaurantId: Joi.string().optional().trim(),
  credentials: Joi.object({
    accessToken: Joi.string().optional().trim(),
    refreshToken: Joi.string().optional().trim().allow(null, ''),
    expiresAt: Joi.date().optional().allow(null),
  }).optional(),
  syncSettings: Joi.object({
    menuSync: Joi.boolean().optional(),
    orderSync: Joi.boolean().optional(),
    autoAcceptOrders: Joi.boolean().optional(),
  }).optional(),
  status: Joi.string().valid('active', 'inactive', 'suspended').optional(),
});

module.exports = {
  configureIntegrationSchema,
  updateIntegrationSchema,
};
