const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const addOnOptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
});

const addOnGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  minSelect: {
    type: Number,
    default: 0,
    min: 0,
  },
  maxSelect: {
    type: Number,
    required: true,
    min: 1,
  },
  options: [addOnOptionSchema],
});

const menuItemSchema = new mongoose.Schema({
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuCategory',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: '',
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  foodType: {
    type: String,
    enum: ['veg', 'non-veg', 'egg'],
    required: true,
    index: true,
  },
  image: {
    type: String,
    default: '',
  },
  tags: {
    type: [String],
    default: [],
  },
  ingredients: {
    type: [String],
    default: [],
  },
  rating: {
    type: Number,
    default: 5.0,
    min: 0,
    max: 5,
  },
  addOnGroups: [addOnGroupSchema],
  status: {
    type: String,
    enum: ['available', 'out_of_stock', 'inactive'],
    default: 'available',
    required: true,
    index: true,
  },
  taxRate: {
    type: Number,
    default: 5.0, // Defaults to 5% standard GST
    min: 0,
  },
  platformMappings: {
    swiggy: {
      itemId: { type: String, default: null, index: true },
      status: { type: String, enum: ['active', 'inactive'], default: 'active' },
      priceOverride: { type: Number, default: null },
    },
    zomato: {
      itemId: { type: String, default: null, index: true },
      status: { type: String, enum: ['active', 'inactive'], default: 'active' },
      priceOverride: { type: Number, default: null },
    },
    magicpin: {
      itemId: { type: String, default: null, index: true },
      status: { type: String, enum: ['active', 'inactive'], default: 'active' },
      priceOverride: { type: Number, default: null },
    },
  },
});

// Compound indexes
// 1. Name must be unique within a restaurant's menu
menuItemSchema.index({ restaurantId: 1, name: 1 }, { unique: true });
// 2. Index for filtering by category inside a restaurant
menuItemSchema.index({ restaurantId: 1, categoryId: 1 });

// Register auditable plugin for tenancy, soft delete, and timestamps
menuItemSchema.plugin(auditablePlugin);

const MenuItem = mongoose.model('MenuItem', menuItemSchema);

module.exports = MenuItem;
