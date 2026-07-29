const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');
const crypto = require('crypto');

const activeSessionSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
    trim: true,
  },
  numberOfPeople: {
    type: Number,
    default: 1,
    min: 1,
  },
  deviceId: {
    type: String,
    required: true,
    index: true,
  },
  deviceDetails: {
    type: String,
    default: '',
  },
  scannedAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  orderIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
  ],
}, { _id: false });

const qrUnlockRequestSchema = new mongoose.Schema({
  requested: {
    type: Boolean,
    default: false,
  },
  customerName: {
    type: String,
    default: '',
    trim: true,
  },
  numberOfPeople: {
    type: Number,
    default: 1,
  },
  deviceId: {
    type: String,
    default: '',
  },
  requestedAt: {
    type: Date,
    default: null,
  },
}, { _id: false });

const tableSchema = new mongoose.Schema({
  tableNumber: {
    type: String,
    required: true,
    trim: true,
  },
  capacity: {
    type: Number,
    default: 4,
    min: 1,
  },
  status: {
    type: String,
    enum: ['vacant', 'occupied', 'out_of_service'],
    default: 'vacant',
    required: true,
    index: true,
  },
  qrCode: {
    code: {
      type: String,
      required: true,
      default: () => crypto.randomBytes(16).toString('hex'),
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  qrUnlockRequest: {
    type: qrUnlockRequestSchema,
    default: () => ({ requested: false }),
  },
  activeSession: {
    type: activeSessionSchema,
    default: null,
  },
});

// Compound indexes
// 1. Table number must be unique per restaurant
tableSchema.index({ restaurantId: 1, tableNumber: 1 }, { unique: true });
// 2. QR code must be unique per restaurant
tableSchema.index({ restaurantId: 1, 'qrCode.code': 1 }, { unique: true });

// Register auditable plugin for tenancy, soft-delete, and timestamps
tableSchema.plugin(auditablePlugin);

const Table = mongoose.model('Table', tableSchema);

module.exports = Table;
