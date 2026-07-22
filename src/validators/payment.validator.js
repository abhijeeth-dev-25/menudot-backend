const Joi = require('joi');
const { PaymentStatus, PaymentMethod } = require('../gateways/payment/types/payment.types');

const createPaymentSchema = Joi.object({
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Payment amount must be a positive number',
    'any.required': 'Payment amount is required',
  }),
  currency: Joi.string().default('INR').uppercase(),
  orderId: Joi.string().required().trim().messages({
    'any.required': 'orderId is required',
  }),
  paymentMethod: Joi.string()
    .valid(PaymentMethod.UPI, PaymentMethod.CARD, PaymentMethod.NETBANKING, PaymentMethod.WALLET, PaymentMethod.MOCK)
    .default(PaymentMethod.MOCK),
  couponCode: Joi.string().optional().trim().uppercase(),
  metadata: Joi.object().optional().default({}),
});

const onboardingPaymentSchema = Joi.object({
  restaurantId: Joi.string().required().trim(),
  couponCode: Joi.string().optional().trim().uppercase(),
});

const verifyOnboardingPaymentSchema = Joi.object({
  restaurantId: Joi.string().required().trim(),
  paymentId: Joi.string().required().trim(),
  forceStatus: Joi.string().valid(...Object.values(PaymentStatus)).optional(),
});

const qrOrderPaymentSchema = Joi.object({
  orderId: Joi.string().required().trim(),
  paymentMethod: Joi.string().default('upi'),
  couponCode: Joi.string().optional().trim().uppercase(),
});

const campaignPaymentSchema = Joi.object({
  campaignId: Joi.string().required().trim(),
  budgetAmount: Joi.number().positive().required(),
  couponCode: Joi.string().optional().trim().uppercase(),
});

const subscriptionPaymentSchema = Joi.object({
  planTier: Joi.string().valid('starter', 'pro', 'enterprise').default('pro'),
  billingCycle: Joi.string().valid('monthly', 'annual').default('monthly'),
  couponCode: Joi.string().optional().trim().uppercase(),
});

const verifyPaymentSchema = Joi.object({
  paymentId: Joi.string().optional().trim(),
  gatewayOrderId: Joi.string().optional().trim(),
  signature: Joi.string().optional().trim(),
  forceStatus: Joi.string().valid(...Object.values(PaymentStatus)).optional(),
}).or('paymentId', 'gatewayOrderId');

const refundPaymentSchema = Joi.object({
  paymentId: Joi.string().required().trim(),
  amount: Joi.number().positive().optional(),
  reason: Joi.string().optional().trim().default('Customer requested refund'),
});

const mockResultSchema = Joi.object({
  paymentId: Joi.string().required().trim(),
  status: Joi.string()
    .valid(...Object.values(PaymentStatus))
    .required()
    .messages({
      'any.only': `Status must be one of: ${Object.values(PaymentStatus).join(', ')}`,
      'any.required': 'status is required',
    }),
});

module.exports = {
  createPaymentSchema,
  onboardingPaymentSchema,
  verifyOnboardingPaymentSchema,
  qrOrderPaymentSchema,
  campaignPaymentSchema,
  subscriptionPaymentSchema,
  verifyPaymentSchema,
  refundPaymentSchema,
  mockResultSchema,
};
