const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    scope: {
      type: String,
      enum: ['platform', 'restaurant'],
      required: true,
      index: true,
    },
    // Null if scope is platform (applies globally or to targeted restaurants)
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      default: null,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscountLimit: {
      type: Number,
      default: null, // Cap for percentage discount
      min: 0,
    },
    targetType: {
      type: String,
      enum: ['cart', 'item', 'category'],
      required: true,
    },
    // Whitelists for item/category targets
    applicableItems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuItem',
      },
    ],
    applicableCategories: [
      {
        type: String,
        trim: true,
      },
    ],
    // Whitelist for platform-scoped coupons targeting specific restaurants
    applicableRestaurants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
      },
    ],
    usageLimit: {
      type: Number,
      default: null, // Max times the coupon code can be redeemed globally
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Coupon = mongoose.model('Coupon', couponSchema, 'coupons');

module.exports = Coupon;
