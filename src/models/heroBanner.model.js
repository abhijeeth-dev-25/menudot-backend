const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const heroBannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      default: '',
      trim: true,
    },
    badgeText: {
      type: String,
      default: '',
      trim: true,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    ctaType: {
      type: String,
      enum: ['category', 'menu_item', 'coupon', 'service', 'external_link', 'none'],
      default: 'none',
    },
    ctaTargetId: {
      type: String,
      default: null,
      trim: true,
    },
    ctaLabel: {
      type: String,
      default: 'Explore Now',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

heroBannerSchema.plugin(auditablePlugin);

const HeroBanner = mongoose.model('HeroBanner', heroBannerSchema, 'hero_banners');

module.exports = HeroBanner;
