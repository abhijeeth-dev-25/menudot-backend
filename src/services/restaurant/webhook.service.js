const MenuItem = require('../../models/menuItem.model');
const OrderRepository = require('../../repositories/restaurant/order.repository');
const AppError = require('../../exceptions/AppError');
const logger = require('../../utils/logger');
const socketManager = require('../../utils/socket');

class WebhookService {
  /**
   * Processes a webhook order from Swiggy.
   * Maps Swiggy item IDs to Menudot items, transforms payload, and stores the order.
   * 
   * @param {object} payload - Swiggy order payload
   */
  async processSwiggyOrder(payload) {
    const { restaurantId, orderId, customer, cart, billing, payment } = payload;

    if (!restaurantId || !orderId || !cart || !billing) {
      throw new AppError(400, 'Invalid Swiggy webhook payload structure.');
    }

    // Check if this order was already processed (idempotency check)
    const existingOrder = await OrderRepository.findByPlatformOrderId(restaurantId, 'swiggy', orderId);
    if (existingOrder) {
      logger.warn({ orderId, restaurantId }, 'Duplicate Swiggy webhook order received. Ignoring.');
      return existingOrder;
    }

    // Map cart items
    const orderItems = [];
    for (const cartItem of cart) {
      // Find local menuItem matching Swiggy external ID
      const menuItem = await MenuItem.findOne({
        restaurantId,
        'platformMappings.swiggy.itemId': cartItem.itemId,
      });

      if (!menuItem) {
        logger.warn(
          { itemId: cartItem.itemId, itemName: cartItem.name, restaurantId },
          'Swiggy item ID not mapped to local menu item. Proceeding with placeholder.'
        );
      }

      orderItems.push({
        itemId: menuItem ? menuItem._id : new mongoose.Types.ObjectId(), // fallback to fresh id if unmapped
        name: cartItem.name,
        price: cartItem.price,
        quantity: cartItem.quantity,
        addOns: (cartItem.addOns || []).map((addon) => ({
          name: addon.name,
          price: addon.price || 0,
        })),
      });
    }

    // Assemble Menudot standard order document
    const orderData = {
      orderSource: 'swiggy',
      platformOrderId: orderId,
      customer: {
        name: customer?.name || 'Swiggy Guest',
        mobile: customer?.phone || '',
        address: customer?.deliveryAddress || '',
      },
      items: orderItems,
      status: 'received',
      totals: {
        subtotal: billing.subTotal,
        tax: billing.tax || 0,
        platformCharge: billing.deliveryCharges || 0,
        discount: billing.discount || 0,
        grandTotal: billing.grandTotal,
      },
      payment: {
        method: payment?.method || 'prepaid',
        status: payment?.status?.toLowerCase() === 'paid' ? 'paid' : 'pending',
        platformTransactionId: payment?.transactionId || null,
      },
    };

    logger.info({ orderId, restaurantId }, 'Saving new Swiggy order from webhook');
    const order = await OrderRepository.create(restaurantId, orderData);
    socketManager.broadcastToRestaurant(restaurantId, 'order_created', order);
    return order;
  }

  /**
   * Processes a webhook order from Zomato.
   * Maps Zomato item IDs to Menudot items, transforms payload, and stores the order.
   * 
   * @param {object} payload - Zomato order payload
   */
  async processZomatoOrder(payload) {
    const { outlet_id: restaurantId, zomato_order_id: orderId, customer_details, items_ordered, charges, payment_mode, payment_status } = payload;

    if (!restaurantId || !orderId || !items_ordered || !charges) {
      throw new AppError(400, 'Invalid Zomato webhook payload structure.');
    }

    const existingOrder = await OrderRepository.findByPlatformOrderId(restaurantId, 'zomato', orderId);
    if (existingOrder) {
      logger.warn({ orderId, restaurantId }, 'Duplicate Zomato webhook order received. Ignoring.');
      return existingOrder;
    }

    const orderItems = [];
    for (const item of items_ordered) {
      const menuItem = await MenuItem.findOne({
        restaurantId,
        'platformMappings.zomato.itemId': item.zomato_item_id,
      });

      if (!menuItem) {
        logger.warn(
          { itemId: item.zomato_item_id, itemName: item.title, restaurantId },
          'Zomato item ID not mapped to local menu item. Proceeding with placeholder.'
        );
      }

      orderItems.push({
        itemId: menuItem ? menuItem._id : new mongoose.Types.ObjectId(),
        name: item.title,
        price: item.base_price,
        quantity: item.qty,
        addOns: (item.customizations || []).map((c) => ({
          name: c.option_name,
          price: c.additional_price || 0,
        })),
      });
    }

    const orderData = {
      orderSource: 'zomato',
      platformOrderId: orderId,
      customer: {
        name: customer_details?.name || 'Zomato Guest',
        mobile: customer_details?.phone || '',
        address: customer_details?.address || '',
      },
      items: orderItems,
      status: 'received',
      totals: {
        subtotal: charges.items_total,
        tax: charges.gst || 0,
        platformCharge: charges.platform_fees || 0,
        discount: charges.discount_amount || 0,
        grandTotal: charges.total_pay,
      },
      payment: {
        method: payment_mode?.toLowerCase() || 'prepaid',
        status: payment_status?.toLowerCase() === 'success' ? 'paid' : 'pending',
        platformTransactionId: null,
      },
    };

    logger.info({ orderId, restaurantId }, 'Saving new Zomato order from webhook');
    const order = await OrderRepository.create(restaurantId, orderData);
    socketManager.broadcastToRestaurant(restaurantId, 'order_created', order);
    return order;
  }

  /**
   * Processes a webhook order from Magicpin.
   * Maps Magicpin item codes to Menudot items, transforms payload, and stores the order.
   * 
   * @param {object} payload - Magicpin order payload
   */
  async processMagicpinOrder(payload) {
    const { merchant_id: restaurantId, magic_order_number: orderId, user, menu_items, amounts } = payload;

    if (!restaurantId || !orderId || !menu_items || !amounts) {
      throw new AppError(400, 'Invalid Magicpin webhook payload structure.');
    }

    const existingOrder = await OrderRepository.findByPlatformOrderId(restaurantId, 'magicpin', orderId);
    if (existingOrder) {
      logger.warn({ orderId, restaurantId }, 'Duplicate Magicpin webhook order received. Ignoring.');
      return existingOrder;
    }

    const orderItems = [];
    for (const item of menu_items) {
      const menuItem = await MenuItem.findOne({
        restaurantId,
        'platformMappings.magicpin.itemId': item.item_code,
      });

      if (!menuItem) {
        logger.warn(
          { itemId: item.item_code, itemName: item.name, restaurantId },
          'Magicpin item code not mapped to local menu item. Proceeding with placeholder.'
        );
      }

      orderItems.push({
        itemId: menuItem ? menuItem._id : new mongoose.Types.ObjectId(),
        name: item.name,
        price: item.unit_price,
        quantity: item.quantity,
        addOns: [], // Magicpin doesn't map add-ons directly in standard payload
      });
    }

    const orderData = {
      orderSource: 'magicpin',
      platformOrderId: orderId,
      customer: {
        name: user?.name || 'Magicpin Guest',
        mobile: user?.contact || '',
        address: '',
      },
      items: orderItems,
      status: 'received',
      totals: {
        subtotal: amounts.subtotal,
        tax: amounts.tax_amount || 0,
        platformCharge: amounts.merchant_fee || 0,
        discount: amounts.discount || 0,
        grandTotal: amounts.net_payable,
      },
      payment: {
        method: 'prepaid',
        status: 'paid',
        platformTransactionId: null,
      },
    };

    logger.info({ orderId, restaurantId }, 'Saving new Magicpin order from webhook');
    const order = await OrderRepository.create(restaurantId, orderData);
    socketManager.broadcastToRestaurant(restaurantId, 'order_created', order);
    return order;
  }
}

// Inline mongoose ObjectId generation fallback for placeholders
const mongoose = require('mongoose');

module.exports = new WebhookService();
