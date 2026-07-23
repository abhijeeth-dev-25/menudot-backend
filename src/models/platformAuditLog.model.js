const mongoose = require('mongoose');

const platformAuditLogSchema = new mongoose.Schema(
  {
    adminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    targetEntity: {
      entityType: { type: String, required: true },
      entityId: { type: String, required: true },
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
    },
  },
  {
    timestamps: true,
  }
);

platformAuditLogSchema.index({ createdAt: -1 });

const PlatformAuditLog = mongoose.model('PlatformAuditLog', platformAuditLogSchema);

module.exports = PlatformAuditLog;
