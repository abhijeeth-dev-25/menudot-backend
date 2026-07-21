const mongoose = require('mongoose');

const platformCampaignSchema = new mongoose.Schema(
  {
    advertiserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'active', 'paused', 'completed'],
      default: 'draft',
      index: true,
    },
    pricing: {
      model: {
        type: String,
        enum: ['CPC', 'CPM'],
        required: true,
      },
      costPerUnit: {
        type: Number,
        required: true,
        min: 0,
      },
      totalBudget: {
        type: Number,
        required: true,
        min: 0,
      },
      dailyBudget: {
        type: Number,
        required: true,
        min: 0,
      },
      spentTotal: {
        type: Number,
        default: 0,
        min: 0,
      },
      spentDaily: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    schedule: {
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
    },
  },
  {
    timestamps: true,
  }
);

platformCampaignSchema.index({ status: 1, 'schedule.startDate': 1, 'schedule.endDate': 1 });

const PlatformCampaign = mongoose.model(
  'PlatformCampaign',
  platformCampaignSchema,
  'platform_campaigns'
);

module.exports = PlatformCampaign;
