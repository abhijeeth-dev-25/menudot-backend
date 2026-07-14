const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const campaignMetricsSchema = new mongoose.Schema({
  impressions: { type: Number, default: 0, min: 0 },
  clicks: { type: Number, default: 0, min: 0 },
}, { _id: false });

const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['sponsored_item', 'discount_banner'],
      required: true,
    },
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      default: null,
      index: true,
    },
    bannerUrl: {
      type: String,
      default: null,
      trim: true,
    },
    discountPercentage: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    budgetLimit: {
      type: Number,
      required: true,
      min: 0,
    },
    currentSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    costPerClick: {
      type: Number,
      default: 5.0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed'],
      default: 'active',
      index: true,
    },
    metrics: {
      type: campaignMetricsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// Apply tenant & audit plugin
campaignSchema.plugin(auditablePlugin);

// Compound index for matching active campaign schedules efficiently
campaignSchema.index({ restaurantId: 1, status: 1, startDate: 1, endDate: 1 });

const Campaign = mongoose.model('Campaign', campaignSchema, 'campaigns');

module.exports = Campaign;
