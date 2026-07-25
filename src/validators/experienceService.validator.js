const Joi = require('joi');

const createExperienceServiceSchema = Joi.object({
  title: Joi.string().required().trim().min(2).max(100),
  category: Joi.string()
    .valid('dining', 'nightlife_bar', 'buffet', 'rooms_stay', 'events_music', 'amenities', 'other')
    .default('dining'),
  tagline: Joi.string().trim().max(150).allow('', null).optional(),
  description: Joi.string().trim().max(1000).allow('', null).optional(),
  imageUrl: Joi.string().uri().allow('', null).optional(),
  iconName: Joi.string().trim().max(50).default('Utensils').optional(),
  highlights: Joi.array().items(Joi.string().trim()).optional(),
  timing: Joi.string().trim().max(100).allow('', null).optional(),
  priceStartingFrom: Joi.number().min(0).allow(null).optional(),
  isAvailable: Joi.boolean().default(true).optional(),
  sortOrder: Joi.number().integer().min(0).default(0).optional(),
});

const updateExperienceServiceSchema = Joi.object({
  title: Joi.string().trim().min(2).max(100).optional(),
  category: Joi.string()
    .valid('dining', 'nightlife_bar', 'buffet', 'rooms_stay', 'events_music', 'amenities', 'other')
    .optional(),
  tagline: Joi.string().trim().max(150).allow('', null).optional(),
  description: Joi.string().trim().max(1000).allow('', null).optional(),
  imageUrl: Joi.string().uri().allow('', null).optional(),
  iconName: Joi.string().trim().max(50).optional(),
  highlights: Joi.array().items(Joi.string().trim()).optional(),
  timing: Joi.string().trim().max(100).allow('', null).optional(),
  priceStartingFrom: Joi.number().min(0).allow(null).optional(),
  isAvailable: Joi.boolean().optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
});

const createHeroBannerSchema = Joi.object({
  title: Joi.string().required().trim().min(2).max(100),
  subtitle: Joi.string().trim().max(200).allow('', null).optional(),
  badgeText: Joi.string().trim().max(50).allow('', null).optional(),
  imageUrl: Joi.string().uri().required(),
  ctaType: Joi.string()
    .valid('category', 'menu_item', 'coupon', 'service', 'external_link', 'none')
    .default('none'),
  ctaTargetId: Joi.string().trim().allow('', null).optional(),
  ctaLabel: Joi.string().trim().max(50).default('Explore Now').optional(),
  isActive: Joi.boolean().default(true).optional(),
  startDate: Joi.date().allow(null).optional(),
  endDate: Joi.date().allow(null).optional(),
  sortOrder: Joi.number().integer().min(0).default(0).optional(),
});

const updateHeroBannerSchema = Joi.object({
  title: Joi.string().trim().min(2).max(100).optional(),
  subtitle: Joi.string().trim().max(200).allow('', null).optional(),
  badgeText: Joi.string().trim().max(50).allow('', null).optional(),
  imageUrl: Joi.string().uri().optional(),
  ctaType: Joi.string()
    .valid('category', 'menu_item', 'coupon', 'service', 'external_link', 'none')
    .optional(),
  ctaTargetId: Joi.string().trim().allow('', null).optional(),
  ctaLabel: Joi.string().trim().max(50).optional(),
  isActive: Joi.boolean().optional(),
  startDate: Joi.date().allow(null).optional(),
  endDate: Joi.date().allow(null).optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
});

const linkSwiggySchema = Joi.object({
  deviceId: Joi.string().required().trim(),
  swiggyUserId: Joi.string().required().trim(),
  swiggyMobile: Joi.string().trim().optional().allow(''),
});

module.exports = {
  createExperienceServiceSchema,
  updateExperienceServiceSchema,
  createHeroBannerSchema,
  updateHeroBannerSchema,
  linkSwiggySchema,
};
