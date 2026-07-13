const Joi = require('joi');
const { objectId } = require('./auth.validator');

const createCategorySchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(50),
  description: Joi.string().trim().max(250).optional().allow(''),
  sortOrder: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid('active', 'inactive').default('active').optional(),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).optional(),
  description: Joi.string().trim().max(250).optional().allow(''),
  sortOrder: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
});

const addOnOptionSchema = Joi.object({
  name: Joi.string().required().trim(),
  price: Joi.number().min(0).required(),
  isDefault: Joi.boolean().default(false).optional(),
});

const addOnGroupSchema = Joi.object({
  name: Joi.string().required().trim(),
  minSelect: Joi.number().integer().min(0).default(0).optional(),
  maxSelect: Joi.number().integer().min(1).required(),
  options: Joi.array().items(addOnOptionSchema).min(1).required(),
});

const createItemSchema = Joi.object({
  categoryId: objectId.required(),
  name: Joi.string().required().trim().min(2).max(100),
  description: Joi.string().trim().max(500).optional().allow(''),
  price: Joi.number().min(0).required(),
  foodType: Joi.string().valid('veg', 'non-veg', 'egg').required(),
  image: Joi.string().uri().optional().allow(''),
  tags: Joi.array().items(Joi.string().trim()).optional(),
  ingredients: Joi.array().items(Joi.string().trim()).optional(),
  addOnGroups: Joi.array().items(addOnGroupSchema).optional(),
  status: Joi.string().valid('available', 'out_of_stock', 'inactive').default('available').optional(),
  taxRate: Joi.number().min(0).default(5.0).optional(),
});

const updateItemSchema = Joi.object({
  categoryId: objectId.optional(),
  name: Joi.string().trim().min(2).max(100).optional(),
  description: Joi.string().trim().max(500).optional().allow(''),
  price: Joi.number().min(0).optional(),
  foodType: Joi.string().valid('veg', 'non-veg', 'egg').optional(),
  image: Joi.string().uri().optional().allow(''),
  tags: Joi.array().items(Joi.string().trim()).optional(),
  ingredients: Joi.array().items(Joi.string().trim()).optional(),
  addOnGroups: Joi.array().items(addOnGroupSchema).optional(),
  status: Joi.string().valid('available', 'out_of_stock', 'inactive').optional(),
  taxRate: Joi.number().min(0).optional(),
});

const updateItemStatusSchema = Joi.object({
  status: Joi.string().valid('available', 'out_of_stock', 'inactive').required(),
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  createItemSchema,
  updateItemSchema,
  updateItemStatusSchema,
};
