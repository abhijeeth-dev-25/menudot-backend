const mongoose = require('mongoose');

const adCreativeSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlatformCampaign',
      required: true,
      index: true,
    },
    placementKey: {
      type: String,
      required: true,
      index: true,
    },
    format: {
      type: String,
      enum: ['image', 'html_widget', 'text_banner', 'video'],
      required: true,
    },
    assets: {
      mediaUrl: {
        type: String,
        required: true,
        trim: true,
      },
      fallbackMediaUrl: {
        type: String,
        trim: true,
      },
      headingText: String,
      bodyText: String,
      ctaText: {
        type: String,
        default: 'Learn More',
      },
    },
    destinationUrl: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const AdCreative = mongoose.model('AdCreative', adCreativeSchema, 'ad_creatives');

module.exports = AdCreative;
