const mongoose = require('mongoose');

const adTargetingRuleSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlatformCampaign',
      required: true,
      unique: true,
      index: true,
    },
    geoScope: {
      countries: [String],
      states: [String],
      cities: [String],
      pincodes: [String],
    },
    targetTags: {
      type: [String],
      index: true,
    },
    restaurantScope: {
      allowList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' }],
      blockList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' }],
    },
    minRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
  },
  {
    timestamps: true,
  }
);

const AdTargetingRule = mongoose.model(
  'AdTargetingRule',
  adTargetingRuleSchema,
  'ad_targeting_rules'
);

module.exports = AdTargetingRule;
