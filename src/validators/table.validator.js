const Joi = require('joi');
const { objectId } = require('./auth.validator');

const createTableSchema = Joi.object({
  tableNumber: Joi.string().required().trim(),
  capacity: Joi.number().integer().min(1).default(4).optional(),
});

const updateTableSchema = Joi.object({
  tableNumber: Joi.string().trim().optional(),
  capacity: Joi.number().integer().min(1).optional(),
});

const toggleQrSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

const customerScanSchema = Joi.object({
  code: Joi.string().required().trim(),
  customerName: Joi.string().required().trim().min(2).max(50),
  numberOfPeople: Joi.number().integer().min(1).default(1).optional(),
  deviceId: Joi.string().required().trim(),
  deviceDetails: Joi.string().trim().optional().allow(''),
});

const serviceCallSchema = Joi.object({
  restaurantId: objectId.required(),
  tableNumber: Joi.string().required(),
  serviceType: Joi.string().valid('water', 'bill', 'cleaning', 'queries', 'others').required(),
});

const placeDineInOrderSchema = Joi.object({
  code: Joi.string().required().trim(),
  deviceId: Joi.string().required().trim(),
  items: Joi.array().items(
    Joi.object({
      itemId: objectId.required(),
      quantity: Joi.number().integer().min(1).required(),
      addOns: Joi.array().items(
        Joi.object({
          name: Joi.string().required().trim(),
          price: Joi.number().min(0).optional(),
        })
      ).optional().default([]),
    })
  ).min(1).required(),
});

module.exports = {
  createTableSchema,
  updateTableSchema,
  toggleQrSchema,
  customerScanSchema,
  serviceCallSchema,
  placeDineInOrderSchema,
};
