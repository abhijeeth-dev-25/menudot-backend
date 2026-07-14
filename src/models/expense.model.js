const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const expenseSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['salaries', 'rent', 'utilities', 'raw_materials', 'marketing', 'others'],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Apply tenant & audit plugin
expenseSchema.plugin(auditablePlugin);

// Compound index for structured expense querying
expenseSchema.index({ restaurantId: 1, category: 1, date: -1 });

const Expense = mongoose.model('Expense', expenseSchema, 'expenses');

module.exports = Expense;
