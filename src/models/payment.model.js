const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');
const { PaymentStatus, RefundStatus, PaymentMethod } = require('../gateways/payment/types/payment.types');

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    gatewayOrderId: {
      type: String,
      default: null,
      index: true,
    },
    gateway: {
      type: String,
      required: true,
      default: 'mock',
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      default: PaymentMethod.MOCK,
    },
    transactionId: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    errorDetails: {
      code: { type: String, default: null },
      message: { type: String, default: null },
    },
    refundDetails: {
      refundId: { type: String, default: null },
      amount: { type: Number, default: 0, min: 0 },
      status: { type: String, enum: Object.values(RefundStatus), default: null },
      reason: { type: String, default: null },
      createdAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Performance compound indexes
paymentSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ restaurantId: 1, paymentId: 1 });

// Register auditable plugin for tenancy scoping & versioning
paymentSchema.plugin(auditablePlugin);

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
