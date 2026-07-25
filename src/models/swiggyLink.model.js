const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const swiggyLinkSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    swiggyUserId: {
      type: String,
      required: true,
      trim: true,
    },
    swiggyMobile: {
      type: String,
      default: '',
      trim: true,
    },
    isLinked: {
      type: Boolean,
      default: true,
    },
    partnerOffers: [
      {
        offerId: String,
        title: String,
        discountPercent: Number,
        maxDiscount: Number,
      },
    ],
    linkedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

swiggyLinkSchema.plugin(auditablePlugin);

const SwiggyLink = mongoose.model('SwiggyLink', swiggyLinkSchema, 'swiggy_links');

module.exports = SwiggyLink;
