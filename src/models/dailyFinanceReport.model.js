const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const revenueSchema = new mongoose.Schema({
  dineIn: { type: Number, default: 0, min: 0 },
  delivery: { type: Number, default: 0, min: 0 },
}, { _id: false });

const expendituresSchema = new mongoose.Schema({
  salariesPaid: { type: Number, default: 0, min: 0 },
  inventoryPurchased: { type: Number, default: 0, min: 0 },
  utilitiesAndOthers: { type: Number, default: 0, min: 0 },
}, { _id: false });

const dailyFinanceReportSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    revenue: {
      type: revenueSchema,
      default: () => ({}),
    },
    expenditures: {
      type: expendituresSchema,
      default: () => ({}),
    },
    netProfitLoss: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Apply tenant & audit plugin
dailyFinanceReportSchema.plugin(auditablePlugin);

// Compound unique index: One report per restaurant per date
dailyFinanceReportSchema.index({ restaurantId: 1, date: -1 }, { unique: true });

const DailyFinanceReport = mongoose.model(
  'DailyFinanceReport',
  dailyFinanceReportSchema,
  'daily_finance_reports'
);

module.exports = DailyFinanceReport;
