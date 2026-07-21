const MenuItem = require('../models/menuItem.model');
const AppError = require('../exceptions/AppError');

/**
 * Pricing and promotion calculator utility.
 */
class PricingCalculator {
  /**
   * Calculates the discount amount for a coupon applied to a cart.
   * 
   * @param {object} coupon - Coupon Mongoose document
   * @param {string} restaurantId - Current restaurant ID
   * @param {Array} cartItems - [{ menuItemId, quantity }]
   */
  async calculateDiscount(coupon, restaurantId, cartItems) {
    if (!coupon || coupon.status !== 'active') {
      throw new AppError(400, 'Coupon code is inactive or invalid.');
    }

    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      throw new AppError(400, 'Coupon code has expired.');
    }

    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      throw new AppError(400, 'Coupon code usage limit has been reached.');
    }

    // 1. Scope checks
    if (coupon.scope === 'restaurant') {
      if (coupon.restaurantId.toString() !== restaurantId.toString()) {
        throw new AppError(400, 'Coupon is not valid for this restaurant.');
      }
    } else if (coupon.scope === 'platform') {
      if (
        coupon.applicableRestaurants?.length &&
        !coupon.applicableRestaurants.some((r) => r.toString() === restaurantId.toString())
      ) {
        throw new AppError(400, 'Coupon is not valid for this restaurant.');
      }
    }

    // 2. Fetch actual menu item data from DB to prevent pricing spoofing
    const itemIds = cartItems.map((item) => item.menuItemId);
    const dbItems = await MenuItem.find({ _id: { $in: itemIds } }).populate('categoryId');

    if (dbItems.length !== cartItems.length) {
      throw new AppError(400, 'Some items in the cart are invalid.');
    }

    // Map quantity and database details
    const enrichedCart = cartItems.map((cartItem) => {
      const dbItem = dbItems.find((item) => item._id.toString() === cartItem.menuItemId.toString());
      return {
        menuItemId: cartItem.menuItemId,
        quantity: cartItem.quantity,
        price: dbItem.price,
        category: dbItem.categoryId ? dbItem.categoryId.name : null,
      };
    });

    // 3. Filter items that are eligible for the coupon
    let eligibleItems = [];
    if (coupon.targetType === 'cart') {
      eligibleItems = enrichedCart;
    } else if (coupon.targetType === 'item') {
      const allowedIds = coupon.applicableItems.map((id) => id.toString());
      eligibleItems = enrichedCart.filter((item) => allowedIds.includes(item.menuItemId.toString()));
    } else if (coupon.targetType === 'category') {
      const allowedCategories = coupon.applicableCategories.map((c) => c.toLowerCase());
      eligibleItems = enrichedCart.filter((item) => {
        // Handle category reference or string
        const categoryName = typeof item.category === 'object' ? item.category.name : item.category;
        return categoryName && allowedCategories.includes(categoryName.toLowerCase());
      });
    }

    if (!eligibleItems.length) {
      throw new AppError(400, 'No eligible items in cart for this coupon.');
    }

    // 4. Calculate subtotal of eligible items
    const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Calculate entire cart subtotal (for minOrderValue check)
    const cartSubtotal = enrichedCart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (cartSubtotal < coupon.minOrderValue) {
      throw new AppError(400, `Minimum order value of ₹${coupon.minOrderValue} required for this coupon.`);
    }

    // 5. Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'flat') {
      discountAmount = coupon.discountValue;
    } else if (coupon.discountType === 'percentage') {
      discountAmount = (eligibleSubtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountLimit !== null && discountAmount > coupon.maxDiscountLimit) {
        discountAmount = coupon.maxDiscountLimit;
      }
    }

    // Cap discount amount at the actual eligible subtotal (discount cannot be higher than price)
    if (discountAmount > eligibleSubtotal) {
      discountAmount = eligibleSubtotal;
    }

    return {
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      eligibleSubtotal,
      cartSubtotal,
    };
  }
}

module.exports = new PricingCalculator();
