const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const restaurantStaffSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'manager', 'server', 'chef', 'custom'],
      required: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    screenAccess: {
      type: [String],
      default: [],
    },
    employment: {
      joinedAt: {
        type: Date,
        default: Date.now,
      },
      salary: {
        amount: { type: Number, default: 0 },
        currency: { type: String, default: 'INR' },
        cycle: { type: String, enum: ['monthly', 'weekly', 'hourly'], default: 'monthly' },
      },
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'terminated'],
      default: 'active',
    },
  },
  {
    // Options
  }
);

// Apply tenant & audit plugin
restaurantStaffSchema.plugin(auditablePlugin);

// Compound index for uniqueness of staff within a restaurant
restaurantStaffSchema.index({ restaurantId: 1, userId: 1 }, { unique: true });
restaurantStaffSchema.index({ userId: 1 });
restaurantStaffSchema.index({ restaurantId: 1, role: 1 });

const RestaurantStaff = mongoose.model('RestaurantStaff', restaurantStaffSchema);

module.exports = RestaurantStaff;
