const CouponService = require('../../services/platform/coupon.service');
const RestaurantStaff = require('../../models/restaurantStaff.model');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../exceptions/AppError');

class CouponController {
  /**
   * Merchant/Platform Admin: Create coupon code.
   */
  createCoupon = asyncHandler(async (req, res) => {
    const { code, scope, discountType, discountValue, targetType, startDate, endDate } = req.body;

    if (!code || !scope || !discountType || !discountValue || !targetType || !startDate || !endDate) {
      throw new AppError(400, 'Missing required coupon configuration fields.');
    }

    // Set restaurantId if scoped to restaurant
    const couponData = { ...req.body };
    if (scope === 'restaurant') {
      if (!req.headers['x-restaurant-id'] && !couponData.restaurantId) {
        throw new AppError(400, 'Restaurant ID is required for restaurant-scoped coupons.');
      }
      couponData.restaurantId = req.headers['x-restaurant-id'] || couponData.restaurantId;

      // Authorize: Must be owner/manager of the restaurant, or platform admin
      const isPlatformUser = ['super_admin', 'platform_admin'].includes(req.user.globalRole);
      if (!isPlatformUser) {
        const staff = await RestaurantStaff.findOne({
          restaurantId: couponData.restaurantId,
          userId: req.user._id,
          status: 'active',
        });
        if (!staff || !['owner', 'manager'].includes(staff.role)) {
          throw new AppError(403, 'Permission denied. Only restaurant owners or managers can create coupons.');
        }
      }
    } else if (scope === 'platform') {
      // Authorize: Must be platform admin/super_admin or sales team
      const allowedPlatform = ['super_admin', 'platform_admin', 'sales'];
      if (!allowedPlatform.includes(req.user.globalRole)) {
        throw new AppError(403, 'Permission denied. Platform coupons can only be created by Platform Admin or Sales team.');
      }
    }

    const coupon = await CouponService.createCoupon(couponData);
    return sendSuccess(res, 201, 'Coupon created successfully', coupon);
  });

  /**
   * Public/Merchant: List all coupons.
   */
  listCoupons = asyncHandler(async (req, res) => {
    const restaurantId = req.headers['x-restaurant-id'];
    const { scope } = req.query;

    const list = await CouponService.listCoupons({ restaurantId, scope });
    return sendSuccess(res, 200, 'Coupons list retrieved successfully', list);
  });

  /**
   * Public: Apply coupon to checkout cart.
   */
  applyCoupon = asyncHandler(async (req, res) => {
    const { couponCode, restaurantId, items } = req.body;

    if (!couponCode || !restaurantId || !items || !items.length) {
      throw new AppError(400, 'Coupon code, restaurant ID, and cart items are required.');
    }

    const result = await CouponService.applyCoupon(couponCode, restaurantId, items);
    return sendSuccess(res, 200, 'Coupon applied successfully', result);
  });
}

module.exports = new CouponController();
