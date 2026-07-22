const Joi = require('joi');
const { objectId } = require('./auth.validator');

const createBookingSchema = Joi.object({
  restaurantId: objectId.optional(),
  bookingDate: Joi.date().iso().required(),
  timeSlot: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  customerName: Joi.string().min(2).max(100).required().trim(),
  customerEmail: Joi.string().email().optional().trim(),
  customerMobile: Joi.string().required().trim(),
  numberOfPeople: Joi.number().integer().min(1).required(),
  tableNumber: Joi.string().optional().trim().allow(null, ''),
  prepayment: Joi.object({
    amount: Joi.number().min(0).optional(),
    transactionId: Joi.string().optional().trim().allow(null, ''),
  }).optional(),
});

const anonymousBookingSchema = Joi.object({
  restaurantId: objectId.required().messages({
    'any.required': 'restaurantId is required to reserve a web slot',
  }),
  bookingDate: Joi.date().iso().required(),
  timeSlot: Joi.string().pattern(/^\d{2}:\d{2}$/).required().messages({
    'string.pattern.base': 'timeSlot must be in HH:MM format (e.g. 20:00)',
  }),
  customerName: Joi.string().min(2).max(100).required().trim(),
  customerEmail: Joi.string().email().required().trim().messages({
    'any.required': 'customerEmail is required to send confirmation email',
  }),
  customerMobile: Joi.string().required().trim(),
  numberOfPeople: Joi.number().integer().min(1).max(30).required(),
  tableNumber: Joi.string().optional().trim().allow(null, ''),
});

const verifyBookingPaymentSchema = Joi.object({
  restaurantId: objectId.optional(),
  bookingId: Joi.string().optional().trim(),
  paymentId: Joi.string().optional().trim(),
}).or('bookingId', 'paymentId');

const redeemCouponSchema = Joi.object({
  couponCode: Joi.string().required().trim().uppercase().messages({
    'any.required': 'couponCode is required for verification',
  }),
  tableNumber: Joi.string().required().trim().messages({
    'any.required': 'tableNumber is required to assign table',
  }),
});

const updateBookingSchema = Joi.object({
  status: Joi.string().valid('pending_payment', 'pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show').optional(),
  tableNumber: Joi.string().optional().trim().allow(null, ''),
  prepayment: Joi.object({
    status: Joi.string().valid('none', 'pending', 'paid', 'refunded').optional(),
    transactionId: Joi.string().optional().trim().allow(null, ''),
  }).optional(),
});

const walkinTableSchema = Joi.object({
  numberOfPeople: Joi.number().integer().min(1).default(1),
  bufferHours: Joi.number().positive().default(2),
});

module.exports = {
  createBookingSchema,
  anonymousBookingSchema,
  verifyBookingPaymentSchema,
  redeemCouponSchema,
  updateBookingSchema,
  walkinTableSchema,
};
