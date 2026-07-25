const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const orderItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true,
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
});

const orderSchema = new mongoose.Schema({
  orderSource: {
    type: String,
    enum: ['pos', 'swiggy', 'zomato', 'magicpin', 'dine_in'],
    required: true,
    index: true,
  },
  platformOrderId: {
    type: String,
    default: null,
    index: true,
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    default: null,
    index: true,
  },
  deviceId: {
    type: String,
    default: null,
    index: true,
  },
  tableNumber: {
    type: String,
    default: null,
  },
  customer: {
    name: { type: String, default: 'Guest Customer' },
    mobile: { type: String, default: '' },
    address: { type: String, default: '' },
  },
  items: [orderItemSchema],
  status: {
    type: String,
    enum: ['received', 'accepted', 'preparing', 'completed', 'cancelled'],
    default: 'received',
    required: true,
    index: true,
  },
  totals: {
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    platformCharge: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, default: null },
    grandTotal: { type: Number, required: true, min: 0 },
  },
  payment: {
    method: { type: String, default: 'prepaid' }, // 'cod', 'online', 'prepaid'
    status: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
    platformTransactionId: { type: String, default: null },
  },
});

// Compound index: Platform Order ID must be unique per restaurant and order source (prevent duplicates)
orderSchema.index({ restaurantId: 1, orderSource: 1, platformOrderId: 1 }, {
  unique: true,
  partialFilterExpression: { platformOrderId: { $type: 'string' } }
});

// Performance Indexes for Dashboard & Reports
orderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, createdAt: -1 });

// Register auditable plugin for tenancy and soft-delete scoping
orderSchema.plugin(auditablePlugin);

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
