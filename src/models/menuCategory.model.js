const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const menuCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50,
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 250,
    default: '',
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    required: true,
    index: true,
  },
});

// Compound indexes
// 1. Slugs must be unique per restaurant
menuCategorySchema.index({ restaurantId: 1, slug: 1 }, { unique: true });
// 2. Index for sorting categories
menuCategorySchema.index({ restaurantId: 1, sortOrder: 1 });

// Register auditable plugin for tenancy, soft delete, and timestamps
menuCategorySchema.plugin(auditablePlugin);

const MenuCategory = mongoose.model('MenuCategory', menuCategorySchema);

module.exports = MenuCategory;
