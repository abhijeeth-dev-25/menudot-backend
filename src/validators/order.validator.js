const Joi = require('joi');

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('accepted', 'preparing', 'completed', 'cancelled').required(),
});

module.exports = {
  updateStatusSchema,
};
