const Joi = require('joi');

const createCampaignSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().trim(),
  type: Joi.string().valid('sponsored_item', 'discount_banner').required(),
  menuItemId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .allow(null),
  bannerUrl: Joi.string().uri().optional().allow('', null),
  discountPercentage: Joi.number().min(0).max(100).optional().allow(null),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
  budgetLimit: Joi.number().min(0).required(),
  costPerClick: Joi.number().min(0).optional(),
});

const updateCampaignSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional().trim(),
  type: Joi.string().valid('sponsored_item', 'discount_banner').optional(),
  menuItemId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .allow(null),
  bannerUrl: Joi.string().uri().optional().allow('', null),
  discountPercentage: Joi.number().min(0).max(100).optional().allow(null),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  budgetLimit: Joi.number().min(0).optional(),
  costPerClick: Joi.number().min(0).optional(),
  status: Joi.string().valid('active', 'paused', 'completed').optional(),
});

module.exports = {
  createCampaignSchema,
  updateCampaignSchema,
};
