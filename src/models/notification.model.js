const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ['all', 'role', 'user', 'screen'],
      default: 'all',
      index: true,
    },
    targetId: {
      type: String, // 'kitchen', 'waiter', 'admin', 'pos', or specific userId / screenId
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'ORDER_CREATED',
        'ORDER_STATUS_CHANGED',
        'SERVICE_CALL',
        'STOCK_ALERT',
        'KITCHEN_DELAY',
        'PAYMENT_RECEIVED',
        'SYSTEM',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    actionUrl: {
      type: String,
      default: '',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
      },
    ],
    dismissedBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        dismissedAt: { type: Date, default: Date.now },
      },
    ],
    deliveryStatus: {
      type: String,
      enum: ['pending', 'delivered', 'failed'],
      default: 'pending',
    },
    dedupKey: {
      type: String,
      index: true,
      sparse: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days retention for unhandled alerts
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimized queries
notificationSchema.index({ restaurantId: 1, targetType: 1, targetId: 1, createdAt: -1 });
notificationSchema.index({ restaurantId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
