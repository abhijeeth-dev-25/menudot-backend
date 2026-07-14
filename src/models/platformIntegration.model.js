const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const credentialsSchema = new mongoose.Schema({
  accessTokenEnc: {
    type: String,
    required: true,
  },
  refreshTokenEnc: {
    type: String,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
}, { _id: false });

const syncSettingsSchema = new mongoose.Schema({
  menuSync: {
    type: Boolean,
    default: true,
  },
  orderSync: {
    type: Boolean,
    default: true,
  },
  autoAcceptOrders: {
    type: Boolean,
    default: true,
  },
}, { _id: false });

const platformIntegrationSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ['swiggy', 'zomato', 'magicpin'],
      required: true,
    },
    externalRestaurantId: {
      type: String,
      required: true,
      trim: true,
    },
    credentials: {
      type: credentialsSchema,
      required: true,
    },
    syncSettings: {
      type: syncSettingsSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
      index: true,
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Apply auditable plugin (injects restaurantId, isDeleted, deletedAt, createdBy, updatedBy, version)
platformIntegrationSchema.plugin(auditablePlugin);

// Compound unique index for restaurantId + platform
platformIntegrationSchema.index({ restaurantId: 1, platform: 1 }, { unique: true });

const PlatformIntegration = mongoose.model('PlatformIntegration', platformIntegrationSchema, 'platform_integrations');

module.exports = PlatformIntegration;
