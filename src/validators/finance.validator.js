const Joi = require('joi');

const createExpenseSchema = Joi.object({
  category: Joi.string()
    .valid('salaries', 'rent', 'utilities', 'raw_materials', 'marketing', 'others')
    .required(),
  amount: Joi.number().min(0).required(),
  description: Joi.string().optional().trim().allow(null, ''),
  date: Joi.date().iso().required(),
});

const getPNLReportSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
});

const generateRollupSchema = Joi.object({
  date: Joi.date().iso().required(),
});

module.exports = {
  createExpenseSchema,
  getPNLReportSchema,
  generateRollupSchema,
};
