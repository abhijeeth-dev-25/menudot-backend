const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const inventoryTransactionSchema = new mongoose.Schema(
  {
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['purchase', 'consumption', 'wastage', 'adjustment'],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      default: null,
      trim: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Apply tenant & audit plugin
inventoryTransactionSchema.plugin(auditablePlugin);

// Compound index for fast stock ledger lookup
inventoryTransactionSchema.index({ restaurantId: 1, inventoryItemId: 1, recordedAt: -1 });

const InventoryTransaction = mongoose.model(
  'InventoryTransaction',
  inventoryTransactionSchema,
  'inventory_transactions'
);

module.exports = InventoryTransaction;
