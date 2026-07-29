const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const billItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    default: null,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  addOns: [
    {
      name: { type: String, required: true },
      price: { type: Number, required: true, min: 0 },
    },
  ],
  tax: {
    type: Number,
    default: 0,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

const billPaymentRecordSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  method: {
    type: String,
    enum: ['cash', 'card_pos', 'counter_upi', 'online_gateway', 'prepaid'],
    required: true,
  },
  transactionRef: {
    type: String,
    default: null,
  },
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  paidAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const billSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    index: true,
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    default: null,
    index: true,
  },
  tableNumber: {
    type: String,
    default: null,
  },
  numberOfPeople: {
    type: Number,
    default: 1,
    min: 1,
  },
  orderIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
  ],
  customer: {
    name: { type: String, default: 'Guest Customer' },
    mobile: { type: String, default: '' },
    email: { type: String, default: '' },
  },
  items: [billItemSchema],
  totals: {
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    platformCharge: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, default: null },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'partially_paid', 'refunded', 'voided'],
    default: 'unpaid',
    required: true,
    index: true,
  },
  paymentChannel: {
    type: String,
    enum: ['offline', 'online', 'mixed'],
    default: 'offline',
    index: true,
  },
  payments: [billPaymentRecordSchema],
  upiPaymentQrUrl: {
    type: String,
    default: null,
  },
  settledAt: {
    type: Date,
    default: null,
  },
  settledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
});

// Compound unique index: invoice number must be unique per restaurant
billSchema.index({ restaurantId: 1, invoiceNumber: 1 }, { unique: true });

// Performance indexes for live bill management & historical reporting
billSchema.index({ restaurantId: 1, paymentStatus: 1, createdAt: -1 });
billSchema.index({ restaurantId: 1, tableNumber: 1, createdAt: -1 });
billSchema.index({ restaurantId: 1, createdAt: -1 });

// Register auditable plugin for tenancy, soft-delete, versioning, and timestamps
billSchema.plugin(auditablePlugin);

const Bill = mongoose.model('Bill', billSchema);

module.exports = Bill;
