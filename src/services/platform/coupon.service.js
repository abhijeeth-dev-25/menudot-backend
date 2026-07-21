const Coupon = require('../../models/coupon.model');
const PricingCalculator = require('../../utils/pricingCalculator');
const AppError = require('../../exceptions/AppError');
const logger = require('../../utils/logger');

class CouponService {
  /**
   * Create a new coupon.
   */
  async createCoupon(couponData) {
    const codeUpper = couponData.code.toUpperCase();
    
    // Check if coupon code already exists
    const existing = await Coupon.findOne({ code: codeUpper });
    if (existing) {
      throw new AppError(409, `Coupon code "${codeUpper}" already exists.`);
    }

    const coupon = new Coupon({
      ...couponData,
      code: codeUpper,
    });
    await coupon.save();
    return coupon;
  }

  /**
   * Get coupon by code.
   */
  async getCouponByCode(code) {
    return Coupon.findOne({ code: code.toUpperCase() });
  }

  /**
   * List coupons. Supports filtering by restaurantId and scope.
   */
  async listCoupons(filters = {}) {
    const query = {};
    if (filters.restaurantId) {
      // Show restaurant-specific coupons or platform-wide coupons
      query.$or = [
        { scope: 'platform' },
        { scope: 'restaurant', restaurantId: filters.restaurantId }
      ];
    } else if (filters.scope) {
      query.scope = filters.scope;
    }
    return Coupon.find(query).sort({ endDate: 1 });
  }

  /**
   * Applies coupon and calculates discount.
   */
  async applyCoupon(code, restaurantId, cartItems) {
    const coupon = await this.getCouponByCode(code);
    if (!coupon) {
      throw new AppError(404, 'Coupon code not found.');
    }

    const calculation = await PricingCalculator.calculateDiscount(coupon, restaurantId, cartItems);

    return {
      couponCode: coupon.code,
      discountAmount: calculation.discountAmount,
      cartSubtotal: calculation.cartSubtotal,
      eligibleSubtotal: calculation.eligibleSubtotal,
    };
  }

  /**
   * Atomic usage count increment.
   */
  async incrementUsage(code, session = null) {
    const updated = await Coupon.findOneAndUpdate(
      { code: code.toUpperCase() },
      { $inc: { usageCount: 1 } },
      { new: true, session }
    );
    if (!updated) {
      logger.warn({ code }, 'Failed to increment coupon usage count: coupon not found');
    }
    return updated;
  }
}

module.exports = new CouponService();
