const Joi = require('joi');
const { objectId } = require('./auth.validator');

const onboardingSchema = Joi.object({
  name: Joi.string().required().trim().min(3).max(100),
  location: Joi.object({
    address: Joi.string().required().trim(),
    coordinates: Joi.array().items(Joi.number()).length(2).required(), // [longitude, latitude]
    city: Joi.string().required().trim(),
    state: Joi.string().required().trim(),
    pincode: Joi.string().required().trim().pattern(/^\d{6}$/), // Standard 6-digit Indian PIN
  }).required(),
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
  outletType: Joi.string()
    .valid('dine_in_and_delivery', 'dine_in_only', 'delivery_only')
    .required(),
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
  bank: Joi.object({
    ifsc: Joi.string()
      .required()
      .uppercase()
      .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/), // Indian IFSC code format
    accountNumber: Joi.string().required().min(9).max(18),
  }).required(),
  menuProfile: Joi.object({
    foodType: Joi.string().valid('veg_only', 'both').required(),
    cuisines: Joi.array().items(Joi.string()).min(1).required(),
    costForTwo: Joi.number().min(50).required(),
    packingCharge: Joi.object({
      type: Joi.string().valid('flat', 'percent', 'none').default('none'),
      value: Joi.number().min(0).default(0),
    }),
  }).required(),
});

const onboardingReviewSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject').required(),
  rejectionReason: Joi.string().when('action', {
    is: 'reject',
    then: Joi.string().required().min(5),
    otherwise: Joi.string().optional().allow(null, ''),
  }),
});

const updateRestaurantProfileSchema = Joi.object({
  name: Joi.string().optional().trim().min(3).max(100),
  imageUrl: Joi.string().uri().optional().allow(null, ''),
  coverImage: Joi.string().uri().optional().allow(null, ''),
  tagline: Joi.string().optional().allow(''),
  amenitiesAndServices: Joi.array().items(Joi.string()).optional(),
  branches: Joi.array().items(

    Joi.object({
      _id: Joi.string().optional(),
      name: Joi.string().required().trim(),
      address: Joi.string().required().trim(),
      city: Joi.string().required().trim(),
      country: Joi.string().optional().default('India'),
      imageUrl: Joi.string().optional().allow(''),
      mobile: Joi.string().required().trim(),
      googleMapsUrl: Joi.string().optional().allow(''),
      isMainBranch: Joi.boolean().optional(),
      isOpen: Joi.boolean().optional(),
      timings: Joi.string().optional().allow(''),
    })
  ).optional(),
  location: Joi.object({
    address: Joi.string().optional().trim(),
    coordinates: Joi.array().items(Joi.number()).length(2).optional(),
    city: Joi.string().optional().trim(),
    state: Joi.string().optional().trim(),
    pincode: Joi.string().optional().trim().pattern(/^\d{6}$/),
  }).optional(),
  schedule: Joi.object({
    workingDays: Joi.array()
      .items(Joi.string().valid('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'))
      .min(1)
      .optional(),
    openTime: Joi.string()
      .optional()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
    closeTime: Joi.string()
      .optional()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
  }).optional(),
  outletType: Joi.string()
    .valid('dine_in_and_delivery', 'dine_in_only', 'delivery_only')
    .optional(),
  menuProfile: Joi.object({
    foodType: Joi.string().valid('veg_only', 'both').optional(),
    cuisines: Joi.array().items(Joi.string()).min(1).optional(),
    costForTwo: Joi.number().min(50).optional(),
    packingCharge: Joi.object({
      type: Joi.string().valid('flat', 'percent', 'none').optional(),
      value: Joi.number().min(0).optional(),
    }).optional(),
  }).optional(),
});


module.exports = {
  onboardingSchema,
  onboardingReviewSchema,
  updateRestaurantProfileSchema,
};
