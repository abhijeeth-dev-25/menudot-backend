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

const recipeItemSchema = new mongoose.Schema({
  inventoryItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true,
  },
  quantityRequired: {
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

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
  isSignatureDish: {
    type: Boolean,
    default: false,
    index: true,
  },
  ingredients: {

    type: [String],
    default: [],
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  ratingCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalRatingPoints: {
    type: Number,
    default: 0,
    min: 0,
  },
  ratingBreakdown: {
    5: { type: Number, default: 0 },
    4: { type: Number, default: 0 },
    3: { type: Number, default: 0 },
    2: { type: Number, default: 0 },
    1: { type: Number, default: 0 },
  },
  popularTags: [
    {
      tag: { type: String, trim: true },
      count: { type: Number, default: 0 },
    },
  ],
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
  recipe: {
    type: [recipeItemSchema],
    default: [],
  },
  platformMappings: {
    swiggy: {
      itemId: { type: String, default: null, index: true },
      status: { type: String, enum: ['active', 'inactive'], default: 'active' },
      priceOverride: { type: Number, default: null },
      syncedAt: { type: Date, default: null },
    },
    zomato: {
      itemId: { type: String, default: null, index: true },
      status: { type: String, enum: ['active', 'inactive'], default: 'active' },
      priceOverride: { type: Number, default: null },
      syncedAt: { type: Date, default: null },
    },
    magicpin: {
      itemId: { type: String, default: null, index: true },
      status: { type: String, enum: ['active', 'inactive'], default: 'active' },
      priceOverride: { type: Number, default: null },
      syncedAt: { type: Date, default: null },
    },
  },
});

// Compound indexes
// 1. Name must be unique within a restaurant's menu
menuItemSchema.index({ restaurantId: 1, name: 1 }, { unique: true });
// 2. Index for filtering by category inside a restaurant
menuItemSchema.index({ restaurantId: 1, categoryId: 1 });

// Pre-save hook: Ensure category belongs to the exact same restaurantId
menuItemSchema.pre('save', async function (next) {
  if (this.isModified('categoryId') || this.isModified('restaurantId')) {
    const MenuCategory = mongoose.model('MenuCategory');
    const category = await MenuCategory.findOne({
      _id: this.categoryId,
      restaurantId: this.restaurantId,
      isDeleted: false,
    });
    if (!category) {
      return next(new Error('Selected category does not exist or does not belong to this restaurant.'));
    }
  }
  next();
});

// Register auditable plugin for tenancy, soft delete, and timestamps
menuItemSchema.plugin(auditablePlugin);

const MenuItem = mongoose.model('MenuItem', menuItemSchema);

module.exports = MenuItem;
