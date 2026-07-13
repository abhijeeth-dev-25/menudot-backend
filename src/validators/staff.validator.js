const Joi = require('joi');

const createStaffSchema = Joi.object({
  fullName: Joi.string().required().trim().min(2).max(50),
  email: Joi.string().email().required().trim().lowercase(),
  mobile: Joi.string().required().trim(),
  password: Joi.string().required().min(6),
  role: Joi.string().valid('owner', 'manager', 'server', 'chef').required(),
  salary: Joi.number().min(0).optional(),
});

const updateStaffSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(50).optional(),
  role: Joi.string().valid('owner', 'manager', 'server', 'chef').optional(),
  status: Joi.string().valid('active', 'suspended', 'terminated').optional(),
  salary: Joi.number().min(0).optional(),
  permissions: Joi.array().items(Joi.string().trim()).optional(),
});

module.exports = {
  createStaffSchema,
  updateStaffSchema,
};
