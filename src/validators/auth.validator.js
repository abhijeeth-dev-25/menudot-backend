const Joi = require('joi');

// Custom Joi validator helper for MongoDB ObjectIds
const objectId = Joi.string().custom((value, helpers) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.message('"{{#label}}" must be a valid MongoDB ObjectId');
  }
  return value;
});

const publicRegisterSchema = Joi.object({
  // Owner Details
  ownerName: Joi.string().required().trim().min(3).max(100),
  email: Joi.string().email().lowercase().trim().required(),
  mobile: Joi.string().trim().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  whatsapp: Joi.string().trim().pattern(/^\+?[1-9]\d{1,14}$/).optional().allow('', null),

  // Restaurant Basic Details
  restaurantName: Joi.string().required().trim().min(3).max(100),
  location: Joi.object({
    address: Joi.string().required().trim(),
    coordinates: Joi.array().items(Joi.number()).length(2).required(), // [longitude, latitude]
    city: Joi.string().required().trim(),
    state: Joi.string().required().trim(),
    pincode: Joi.string().required().trim().pattern(/^\d{6}$/), // Standard 6-digit Indian PIN
  }).required(),

  // Schedule
  schedule: Joi.object({
    workingDays: Joi.array()
      .items(Joi.string().valid('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'))
      .min(1)
      .required(),
    openTime: Joi.string()
      .required()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/), // "HH:MM" 24h format
    closeTime: Joi.string()
      .required()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
  }).required(),

  // Documents and Details
  outletType: Joi.string()
    .valid('dine_in_and_delivery', 'dine_in_only', 'delivery_only')
    .required(),

  // Legal
  legal: Joi.object({
    pan: Joi.string()
      .required()
      .uppercase()
      .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/), // Indian PAN format
    gstin: Joi.string()
      .required()
      .uppercase()
      .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/), // Indian GSTIN format
    fssaiNumber: Joi.string()
      .required()
      .pattern(/^\d{14}$/), // FSSAI 14-digit format
    fssaiExpiry: Joi.date().greater('now').required(),
  }).required(),

  // Bank
  bank: Joi.object({
    ifsc: Joi.string()
      .required()
      .uppercase()
      .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/), // Indian IFSC format
    accountNumber: Joi.string().required().min(9).max(18),
  }).required(),

  // Menu Setup
  menuSetup: Joi.object({
    foodType: Joi.string().valid('veg_only', 'both').required(),
    cuisines: Joi.array().items(Joi.string()).min(1).required(),
    costForTwo: Joi.number().min(50).required(),
    packingCharge: Joi.object({
      type: Joi.string().valid('flat', 'percent', 'none').default('none'),
      value: Joi.number().min(0).default(0),
    }),
  }).required(),

  // Terms and conditions acceptance
  termsAccepted: Joi.boolean().valid(true).required(),
});

const loginSchema = Joi.object({
  identifier: Joi.string().required().trim(),
  password: Joi.string().required(),
});

const screenLoginSchema = Joi.object({
  restaurantId: objectId.required(),
  username: Joi.string().required().trim(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

module.exports = {
  objectId,
  publicRegisterSchema,
  loginSchema,
  screenLoginSchema,
  refreshSchema,
};
