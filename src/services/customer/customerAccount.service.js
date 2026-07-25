const SwiggyLink = require('../../models/swiggyLink.model');
const Order = require('../../models/order.model');
const Table = require('../../models/table.model');
const AppError = require('../../exceptions/AppError');

class CustomerAccountService {
  /**
   * Links Swiggy partner account for exclusive member discounts
   */
  static async linkSwiggyAccount(restaurantId, { deviceId, swiggyUserId, swiggyMobile }) {
    if (!restaurantId || !deviceId || !swiggyUserId) {
      throw new AppError(400, 'Restaurant ID, Device ID, and Swiggy User ID are required');
    }

    // Default mock partner offers unlocked upon linking
    const partnerOffers = [
      {
        offerId: 'SWIGGY_PARTNER_15',
        title: 'Swiggy One Special 15% OFF',
        discountPercent: 15,
        maxDiscount: 150,
      },
      {
        offerId: 'SWIGGY_DELIGHT_FREE_DRINK',
        title: 'Complimentary Beverage with Swiggy Gold',
        discountPercent: 10,
        maxDiscount: 100,
      },
    ];

    const link = await SwiggyLink.findOneAndUpdate(
      { restaurantId, deviceId },
      {
        restaurantId,
        deviceId,
        swiggyUserId,
        swiggyMobile: swiggyMobile || '',
        isLinked: true,
        partnerOffers,
        linkedAt: new Date(),
      },
      { upsert: true, new: true, runValidators: true }
    );

    return {
      isLinked: true,
      swiggyUserId: link.swiggyUserId,
      partnerOffers: link.partnerOffers,
    };
  }

  /**
   * Fetch Swiggy partner link status for device
   */
  static async getSwiggyStatus(restaurantId, deviceId) {
    const link = await SwiggyLink.findOne({ restaurantId, deviceId, isLinked: true }).lean();
    if (!link) {
      return { isLinked: false, partnerOffers: [] };
    }
    return {
      isLinked: true,
      swiggyUserId: link.swiggyUserId,
      partnerOffers: link.partnerOffers,
    };
  }

  /**
   * Fetch customer order history for a device
   */
  static async getOrderHistory(restaurantId, deviceId) {
    if (!restaurantId || !deviceId) {
      throw new AppError(400, 'Restaurant ID and Device ID are required');
    }

    const orders = await Order.find({ restaurantId, deviceId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return orders.map((o) => ({
      id: o._id,
      orderNumber: o.platformOrderId || o.orderNumber || o._id.toString(),
      platform: o.platform || o.orderSource,
      items: o.items,
      status: o.status,
      paymentMethod: o.payment ? o.payment.method : (o.paymentMethod || 'prepaid'),
      total: (o.totals && o.totals.grandTotal) !== undefined ? o.totals.grandTotal : (o.totalAmount || o.total || 0),
      createdAt: o.createdAt,
    }));
  }

  /**
   * Retrieves live bill summary for active table session
   */
  static async getBillSummary(restaurantId, { tableId = null, deviceId = null }) {
    if (!restaurantId) {
      throw new AppError(400, 'Restaurant ID is required');
    }

    let query = { restaurantId, status: { $ne: 'cancelled' } };

    if (tableId) {
      query.tableId = tableId;
    } else if (deviceId) {
      query.deviceId = deviceId;
    } else {
      throw new AppError(400, 'Table ID or Device ID is required');
    }

    const orders = await Order.find(query).sort({ createdAt: 1 }).lean();

    let subtotal = 0;
    let totalTax = 0;
    let packingCharges = 0;
    let totalDiscount = 0;

    const allItems = [];

    orders.forEach((o) => {
      const orderSubtotal = (o.totals && o.totals.subtotal) !== undefined ? o.totals.subtotal : (o.subtotal || 0);
      const orderTax = (o.totals && o.totals.tax) !== undefined ? o.totals.tax : (o.tax || 0);
      const orderPacking = (o.totals && o.totals.packingCharges) !== undefined ? o.totals.packingCharges : (o.packingCharges || 0);
      const orderDiscount = (o.totals && o.totals.discount) !== undefined ? o.totals.discount : (o.discount || 0);

      subtotal += orderSubtotal;
      totalTax += orderTax;
      packingCharges += orderPacking;
      totalDiscount += orderDiscount;

      if (Array.isArray(o.items)) {
        o.items.forEach((item) => {
          allItems.push({
            orderNumber: o.orderNumber,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            selectedAddons: item.addOns || item.selectedAddons || [],
            specialNotes: item.specialNotes || '',
            itemTotal: item.price * item.quantity,
          });
        });
      }
    });

    const netPayable = Math.max(0, subtotal + totalTax + packingCharges - totalDiscount);

    return {
      orderCount: orders.length,
      items: allItems,
      subtotal,
      tax: totalTax,
      packingCharges,
      discount: totalDiscount,
      totalPayable: netPayable,
      orders: orders.map((o) => ({
        id: o._id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: o.totalAmount || o.total || 0,
        createdAt: o.createdAt,
      })),
    };
  }
}

module.exports = CustomerAccountService;
