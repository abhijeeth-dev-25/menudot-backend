const Joi = require('joi');

const generateTableBillSchema = Joi.object({
  tableId: Joi.string().required(),
});

const settleBillSchema = Joi.object({
  payments: Joi.array()
    .items(
      Joi.object({
        amount: Joi.number().positive().required(),
        method: Joi.string()
          .valid('cash', 'card_pos', 'counter_upi', 'online_gateway', 'prepaid')
          .required(),
        transactionRef: Joi.string().allow('', null).optional(),
      })
    )
    .optional(),
  customer: Joi.object({
    name: Joi.string().allow('', null).optional(),
    mobile: Joi.string().allow('', null).optional(),
    email: Joi.string().email().allow('', null).optional(),
  }).optional(),
});

const getBillHistorySchema = Joi.object({
  paymentStatus: Joi.string().valid('unpaid', 'paid', 'partially_paid', 'refunded', 'voided').optional(),
  paymentChannel: Joi.string().valid('offline', 'online', 'mixed').optional(),
  paymentMethod: Joi.string().valid('cash', 'card_pos', 'counter_upi', 'online_gateway', 'prepaid').optional(),
  tableNumber: Joi.string().optional(),
  invoiceNumber: Joi.string().optional(),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  generateTableBillSchema,
  settleBillSchema,
  getBillHistorySchema,
};
