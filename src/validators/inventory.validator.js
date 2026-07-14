const Joi = require('joi');

const createInventoryItemSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().trim(),
  unit: Joi.string().valid('kg', 'g', 'ltr', 'ml', 'pcs', 'box').required(),
  currentStock: Joi.number().min(0).optional(),
  reorderThreshold: Joi.number().min(0).optional(),
  costPerUnit: Joi.number().min(0).required(),
});

const updateInventoryItemSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional().trim(),
  unit: Joi.string().valid('kg', 'g', 'ltr', 'ml', 'pcs', 'box').optional(),
  currentStock: Joi.number().min(0).optional(),
  reorderThreshold: Joi.number().min(0).optional(),
  costPerUnit: Joi.number().min(0).optional(),
});

const adjustStockSchema = Joi.object({
  type: Joi.string().valid('purchase', 'wastage', 'adjustment').required(),
  quantity: Joi.number().positive().required(),
  reason: Joi.string().optional().trim().allow(null, ''),
});

module.exports = {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  adjustStockSchema,
};
