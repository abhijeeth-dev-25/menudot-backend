const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const inventoryItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      enum: ['kg', 'g', 'ltr', 'ml', 'pcs', 'box'],
      required: true,
    },
    currentStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    reorderThreshold: {
      type: Number,
      default: 0,
      min: 0,
    },
    costPerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Apply tenant & audit plugin
inventoryItemSchema.plugin(auditablePlugin);

// Compound unique index: item name is unique per restaurant
inventoryItemSchema.index({ restaurantId: 1, name: 1 }, { unique: true });

const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema, 'inventory_items');

module.exports = InventoryItem;
