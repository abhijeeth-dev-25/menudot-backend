const Joi = require('joi');
const { objectId } = require('./auth.validator');

const createBookingSchema = Joi.object({
  restaurantId: objectId.optional(),
  bookingDate: Joi.date().iso().required(),
  timeSlot: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  customerName: Joi.string().min(2).max(100).required().trim(),
  customerMobile: Joi.string().required().trim(),
  numberOfPeople: Joi.number().integer().min(1).required(),
  tableNumber: Joi.string().optional().trim().allow(null, ''),
  prepayment: Joi.object({
    amount: Joi.number().min(0).optional(),
    transactionId: Joi.string().optional().trim().allow(null, ''),
  }).optional(),
});

const updateBookingSchema = Joi.object({
  status: Joi.string().valid('pending', 'confirmed', 'completed', 'cancelled', 'no_show').optional(),
  tableNumber: Joi.string().optional().trim().allow(null, ''),
  prepayment: Joi.object({
    status: Joi.string().valid('none', 'pending', 'paid', 'refunded').optional(),
    transactionId: Joi.string().optional().trim().allow(null, ''),
  }).optional(),
});

module.exports = {
  createBookingSchema,
  updateBookingSchema,
};
