const Joi = require('joi');
const { objectId } = require('./auth.validator');

const createScreenSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(50),
  screenType: Joi.string().valid('kitchen_display', 'cashier', 'server', 'owner', 'reception').required(),
  username: Joi.string().required().trim().alphanum().min(3).max(30),
  password: Joi.string().required().min(6),
  assignedRole: Joi.string().valid('owner', 'manager', 'server', 'chef').required(),
  permissions: Joi.array().items(Joi.string().trim()).optional(),
  allowedServices: Joi.array().items(Joi.string().valid('water', 'bill', 'cleaning', 'queries', 'others')).optional(),
  allowedTables: Joi.array().items(Joi.string().trim()).optional(),
  assignedStaffId: objectId.optional().allow(null),
});

const updateScreenSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).optional(),
  screenType: Joi.string().valid('kitchen_display', 'cashier', 'server', 'owner', 'reception').optional(),
  assignedRole: Joi.string().valid('owner', 'manager', 'server', 'chef').optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  permissions: Joi.array().items(Joi.string().trim()).optional(),
  allowedServices: Joi.array().items(Joi.string().valid('water', 'bill', 'cleaning', 'queries', 'others')).optional(),
  allowedTables: Joi.array().items(Joi.string().trim()).optional(),
  assignedStaffId: objectId.optional().allow(null),
});

const screenLoginSchema = Joi.object({
  username: Joi.string().required().trim(),
  password: Joi.string().required().trim(),
  restaurantId: objectId.required(),
});

module.exports = {
  createScreenSchema,
  updateScreenSchema,
  screenLoginSchema,
};
