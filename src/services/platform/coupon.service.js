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
   * Validates coupon code and calculates discount for an amount.
   */
  async validateAndCalculateDiscount({ couponCode, orderAmount, restaurantId }) {
    if (!couponCode) return { discountAmount: 0 };
    const coupon = await this.getCouponByCode(couponCode);
    if (!coupon || coupon.status !== 'active') {
      throw new AppError(404, `Coupon code '${couponCode}' is invalid or expired.`);
    }

    const now = new Date();
    if (coupon.startDate > now || coupon.endDate < now) {
      throw new AppError(400, `Coupon code '${couponCode}' has expired.`);
    }

    const amount = Number(orderAmount) || 0;
    if (coupon.minOrderValue && amount < coupon.minOrderValue) {
      throw new AppError(400, `Minimum order value of ₹${coupon.minOrderValue} required for coupon '${couponCode}'.`);
    }

    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round((amount * (coupon.discountValue / 100)) * 100) / 100;
      if (coupon.maxDiscountLimit && discountAmount > coupon.maxDiscountLimit) {
        discountAmount = coupon.maxDiscountLimit;
      }
    } else if (coupon.discountType === 'flat') {
      discountAmount = coupon.discountValue;
    }

    discountAmount = Math.min(amount, discountAmount);

    return {
      couponCode: coupon.code,
      discountAmount,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    };
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

  /**
   * Update coupon attributes.
   */
  async updateCoupon(id, updateData) {
    const updated = await Coupon.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true });
    if (!updated) {
      throw new AppError(404, 'Coupon not found.');
    }
    return updated;
  }

  /**
   * Delete a coupon.
   */
  async deleteCoupon(id) {
    const deleted = await Coupon.findByIdAndDelete(id);
    if (!deleted) {
      throw new AppError(404, 'Coupon not found.');
    }
    return deleted;
  }
}

module.exports = new CouponService();
