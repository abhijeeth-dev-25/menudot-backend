const TableRepository = require('../../repositories/restaurant/table.repository');
const Table = require('../../models/table.model');
const Restaurant = require('../../models/restaurant.model');
const MenuCategory = require('../../models/menuCategory.model');
const MenuItem = require('../../models/menuItem.model');
const OrderRepository = require('../../repositories/restaurant/order.repository');
const { runTransaction } = require('../../utils/transaction');
const socketManager = require('../../utils/socket');
const CouponService = require('../platform/coupon.service');
const AppError = require('../../exceptions/AppError');
const logger = require('../../utils/logger');

class TableService {
  async createTable(restaurantId, tableData) {
    const { tableNumber } = tableData;

    // Verify table number uniqueness per restaurant
    const existingTable = await TableRepository.findByTableNumber(restaurantId, tableNumber);
    if (existingTable) {
      throw new AppError(400, `Table "${tableNumber}" already exists.`);
    }

    return TableRepository.create(restaurantId, tableData);
  }

  async getTables(restaurantId) {
    return TableRepository.findAll(restaurantId);
  }

  async updateTable(restaurantId, id, updateData) {
    const table = await TableRepository.findById(restaurantId, id);
    if (!table) {
      throw new AppError(404, 'Table not found.');
    }

    if (updateData.tableNumber && updateData.tableNumber !== table.tableNumber) {
      const existingTable = await TableRepository.findByTableNumber(restaurantId, updateData.tableNumber);
      if (existingTable) {
        throw new AppError(400, `Table "${updateData.tableNumber}" already exists.`);
      }
    }

    return TableRepository.update(restaurantId, id, updateData);
  }

  async deleteTable(restaurantId, id) {
    const table = await TableRepository.findById(restaurantId, id);
    if (!table) {
      throw new AppError(404, 'Table not found.');
    }

    return TableRepository.delete(restaurantId, id);
  }

  async toggleQrCode(restaurantId, id, isActive) {
    const table = await TableRepository.findById(restaurantId, id);
    if (!table) {
      throw new AppError(404, 'Table not found.');
    }

    // Toggle scanning permission
    return TableRepository.update(restaurantId, id, { 'qrCode.isActive': isActive });
  }

  /**
   * Processes a public customer scan. Initiates active table session.
   * Enforces device session locking, and returns standard customer catalog.
   */
  async processCustomerScan(scanData) {
    const { code, customerName, numberOfPeople, deviceId, deviceDetails } = scanData;

    // 1. Locate the table globally by secure QR code token
    const table = await TableRepository.findByQrCode(code);
    if (!table) {
      throw new AppError(404, 'Invalid table QR Code.');
    }

    const { restaurantId, tableNumber } = table;

    // 2. Enforce QR scanning is active/enabled by staff
    if (!table.qrCode.isActive) {
      // Record pending walk-in QR unlock request on table
      await TableRepository.update(restaurantId, table._id, {
        qrUnlockRequest: {
          requested: true,
          customerName: customerName || 'Walk-in Guest',
          numberOfPeople: numberOfPeople || 1,
          deviceId: deviceId || '',
          requestedAt: new Date(),
        },
      });

      // Dispatch real-time WebSocket alert to staff/KDS/POS terminals
      socketManager.emitToRestaurantRoom(restaurantId, 'staff:qr_unlock_request', {
        tableId: table._id,
        tableNumber,
        customerName: customerName || 'Walk-in Guest',
        numberOfPeople: numberOfPeople || 1,
        deviceId: deviceId || '',
        requestedAt: new Date(),
      });

      logger.info(
        { restaurantId, tableNumber, customerName, deviceId },
        'Walk-in customer scanned inactive QR code - staff unlock request dispatched'
      );

      const err = new AppError(
        403,
        `Table "${tableNumber}" ordering is currently locked. Restaurant staff has been notified to activate your table.`,
        true,
        {
          status: 'activation_pending',
          tableId: table._id,
          tableNumber,
          requestedAt: new Date(),
        }
      );
      throw err;
    }

    // 3. Enforce device session lock
    if (table.activeSession) {
      if (table.activeSession.deviceId !== deviceId && !table.activeSession.deviceId.startsWith('booking_')) {
        throw new AppError(403, 'A customer session is already active at this table. Only one device can order at a time.');
      }
      
      // Adopt session with customer deviceId and renew timestamp
      const updatedTable = await TableRepository.update(
        restaurantId,
        table._id,
        {
          'activeSession.deviceId': deviceId,
          'activeSession.scannedAt': new Date(),
        }
      );
      
      // Fetch menu catalog for client
      return this._assembleCustomerCatalog(restaurantId, updatedTable);
    }

    // 4. Create new active session
    const sessionData = {
      customerName,
      numberOfPeople,
      deviceId,
      deviceDetails: deviceDetails || '',
      scannedAt: new Date(),
      orderIds: [],
    };

    const updatedTable = await TableRepository.update(
      restaurantId,
      table._id,
      {
        status: 'occupied',
        activeSession: sessionData,
      }
    );

    logger.info(
      { restaurantId, tableNumber, customerName, deviceId },
      'Customer session initialized successfully at table'
    );

    // 5. Assemble and return restaurant menu catalog
    return this._assembleCustomerCatalog(restaurantId, updatedTable);
  }

  /**
   * Completes table checkout, clears session info, turns off QR code scanning,
   * and credits any pre-paid booking fee discount to final orders.
   */
  async checkoutTable(restaurantId, id) {
    const BookingRepository = require('../../repositories/restaurant/booking.repository');
    const table = await TableRepository.findById(restaurantId, id);
    if (!table) {
      throw new AppError(404, 'Table not found.');
    }

    // Check if an active seated booking exists for this table
    const activeBooking = await BookingRepository.findActiveSeatedBookingForTable(restaurantId, id);
    if (activeBooking && activeBooking.prepayment && activeBooking.prepayment.amount > 0) {
      const prepaidCredit = activeBooking.prepayment.amount;

      // Find active orders for the table
      const activeOrders = await OrderRepository.findAll(restaurantId, {
        tableId: id,
        status: { $ne: 'cancelled' },
      });

      if (activeOrders.length > 0) {
        // Apply prepaid discount to the latest active order
        const targetOrder = activeOrders[0];
        const newDiscount = (targetOrder.totals.discount || 0) + prepaidCredit;
        const newGrandTotal = Math.max(0, targetOrder.totals.subtotal + targetOrder.totals.tax + (targetOrder.totals.platformCharge || 0) - newDiscount);

        await OrderRepository.update(restaurantId, targetOrder._id, {
          'totals.discount': newDiscount,
          'totals.grandTotal': newGrandTotal,
          status: 'completed',
        });

        logger.info(
          { restaurantId, tableNumber: table.tableNumber, prepaidCredit, orderId: targetOrder._id },
          'Applied pre-paid booking fee discount to final order checkout'
        );

        await BookingRepository.update(restaurantId, activeBooking._id, {
          status: 'completed',
          orderId: targetOrder._id,
        });
      } else {
        await BookingRepository.update(restaurantId, activeBooking._id, {
          status: 'completed',
        });
      }
    }

    logger.info({ restaurantId, tableNumber: table.tableNumber }, 'Checking out table session');

    return TableRepository.update(restaurantId, id, {
      status: 'vacant',
      'qrCode.isActive': false,
      activeSession: null,
      qrUnlockRequest: {
        requested: false,
        customerName: '',
        numberOfPeople: 1,
        deviceId: '',
        requestedAt: null,
      },
    });
  }

  /**
   * Staff approves walk-in customer QR activation request, sets qrCode.isActive = true,
   * updates status to occupied, and triggers real-time 'table:qr_unlocked' WebSocket notification to customer.
   */
  async unlockTableAccess(restaurantId, id, data = {}) {
    const table = await TableRepository.findById(restaurantId, id);
    if (!table) {
      throw new AppError(404, 'Table not found.');
    }

    const { customerName, numberOfPeople, deviceId, deviceDetails } = data;

    const payload = {
      'qrCode.isActive': true,
      status: 'occupied',
      qrUnlockRequest: {
        requested: false,
        customerName: '',
        numberOfPeople: 1,
        deviceId: '',
        requestedAt: null,
      },
    };

    const resolvedName = customerName || table.qrUnlockRequest?.customerName || 'Walk-in Guest';
    const resolvedPeople = numberOfPeople || table.qrUnlockRequest?.numberOfPeople || 1;
    const resolvedDeviceId = deviceId || table.qrUnlockRequest?.deviceId || `staff_unlock_${Date.now()}`;

    payload.activeSession = {
      customerName: resolvedName,
      numberOfPeople: resolvedPeople,
      deviceId: resolvedDeviceId,
      deviceDetails: deviceDetails || '',
      scannedAt: new Date(),
      orderIds: [],
    };

    const updatedTable = await TableRepository.update(restaurantId, id, payload);

    // Notify connected terminals and customer device via WebSockets
    socketManager.emitToRestaurantRoom(restaurantId, 'table:qr_unlocked', {
      tableId: id,
      tableNumber: table.tableNumber,
      qrCodeActive: true,
      activeSession: updatedTable.activeSession,
    });

    logger.info(
      { restaurantId, tableNumber: table.tableNumber, customerName: resolvedName },
      'Staff unlocked table QR code access for walk-in guest'
    );

    return updatedTable;
  }

  /**
   * Retrieves all pending table unlock requests for staff dashboard.
   */
  async getPendingUnlockRequests(restaurantId) {
    const tables = await TableRepository.findAll(restaurantId, { 'qrUnlockRequest.requested': true });
    return tables;
  }

  /**
   * Helper to fetch restaurant info and active menu tree.
   * Used on customer scans to load everything in 1 payload.
   */
  async _assembleCustomerCatalog(restaurantId, table) {
    const { safeRedisCall } = require('../../database/redis');
    const cacheKey = `catalog:${restaurantId}`;

    let cachedData = await safeRedisCall(async (client) => {
      const data = await client.get(cacheKey);
      return data ? JSON.parse(data) : null;
    });

    let restaurant;
    let menuTree;

    if (cachedData) {
      restaurant = cachedData.restaurant;
      menuTree = cachedData.menu;
    } else {
      restaurant = await Restaurant.findById(restaurantId).select('name slug location menuProfile ratingsSummary');
      const categories = await MenuCategory.find({ restaurantId, status: 'active' }).sort({ sortOrder: 1 });
      const items = await MenuItem.find({ restaurantId, status: 'available' });

      // Group items by categoryId for easy client-side parsing
      menuTree = categories.map((cat) => {
        const catItems = items
          .filter((item) => item.categoryId.toString() === cat._id.toString())
          .map((itemObj) => {
            const item = itemObj.toObject ? itemObj.toObject() : itemObj;
            // High rating badge logic
            const isTopRated = (item.rating || 0) >= 4.5 && (item.ratingCount || 0) >= 1;
            return {
              ...item,
              isTopRated,
            };
          });
        return {
          category: cat,
          items: catItems,
        };
      });

      // Write to cache (TTL: 24 hours)
      await safeRedisCall(async (client) => {
        await client.setEx(cacheKey, 86400, JSON.stringify({ restaurant, menu: menuTree }));
      });
    }

    return {
      table: {
        id: table._id,
        tableNumber: table.tableNumber,
        status: table.status,
        session: table.activeSession,
      },
      restaurant,
      menu: menuTree,
    };
  }

  async placeDineInOrder(orderData) {
    const { code, deviceId, items, couponCode } = orderData;

    // 1. Resolve table and validate session active state
    const initialTable = await TableRepository.findByQrCode(code);
    if (!initialTable) {
      throw new AppError(404, 'Table not found or invalid QR code.');
    }

    if (!initialTable.qrCode.isActive) {
      throw new AppError(400, 'This QR code is currently inactive and cannot accept orders.');
    }

    if (initialTable.status !== 'occupied' || !initialTable.activeSession) {
      throw new AppError(400, 'No active customer session exists at this table.');
    }

    if (initialTable.activeSession.deviceId !== deviceId) {
      throw new AppError(403, 'A customer session is already active at this table on another device.');
    }

    const restaurantId = initialTable.restaurantId.toString();

    // 2. Validate menu items, add-ons, and calculate totals using DB source-of-truth prices
    let subtotal = 0;
    let totalTax = 0;
    const validatedItems = [];

    for (const cartItem of items) {
      const menuItem = await MenuItem.findOne({
        _id: cartItem.itemId,
        restaurantId,
        status: 'available',
        isDeleted: false,
      });

      if (!menuItem) {
        throw new AppError(400, `Menu item is out of stock or unavailable.`);
      }

      const itemPrice = menuItem.price;
      let addOnSubtotal = 0;
      const validatedAddons = [];

      // Validate each selected add-on option matches the DB schema options
      for (const selectedAddon of (cartItem.addOns || [])) {
        let matchedOption = null;
        for (const group of menuItem.addOnGroups) {
          const option = group.options.find((opt) => opt.name === selectedAddon.name);
          if (option) {
            matchedOption = option;
            break;
          }
        }

        if (!matchedOption) {
          throw new AppError(
            400,
            `Invalid add-on option "${selectedAddon.name}" for menu item "${menuItem.name}".`
          );
        }

        validatedAddons.push({
          name: matchedOption.name,
          price: matchedOption.price,
        });
        addOnSubtotal += matchedOption.price;
      }

      const itemTotal = (itemPrice + addOnSubtotal) * cartItem.quantity;
      const itemTax = itemTotal * ((menuItem.taxRate || 5.0) / 100);

      subtotal += itemTotal;
      totalTax += itemTax;

      validatedItems.push({
        itemId: menuItem._id,
        name: menuItem.name,
        price: itemPrice,
        quantity: cartItem.quantity,
        addOns: validatedAddons,
      });
    }

    let discountAmount = 0;
    if (couponCode) {
      const cartItemsForCalc = validatedItems.map(item => ({
        menuItemId: item.itemId.toString(),
        quantity: item.quantity,
      }));
      const calcResult = await CouponService.applyCoupon(couponCode, restaurantId, cartItemsForCalc);
      discountAmount = calcResult.discountAmount;
    }

    const grandTotal = Math.max(0, subtotal + totalTax - discountAmount);
    let finalOrder;

    // 3. Save order and update table session in a transaction
    await runTransaction(async (session) => {
      // Reload table in the transaction session to prevent race conditions
      const tableInTx = await Table.findOne({ _id: initialTable._id }).session(session);
      if (!tableInTx || tableInTx.status !== 'occupied' || !tableInTx.activeSession) {
        throw new AppError(400, 'Table session was modified or closed.');
      }

      const finalOrderData = {
        orderSource: 'dine_in',
        customer: {
          name: tableInTx.activeSession.customerName,
          mobile: '',
          address: '',
        },
        items: validatedItems,
        status: 'received',
        totals: {
          subtotal,
          tax: totalTax,
          platformCharge: 0,
          discount: discountAmount,
          couponCode: couponCode ? couponCode.toUpperCase() : null,
          grandTotal,
        },
        payment: {
          method: 'prepaid',
          status: 'pending',
        },
        tableId: tableInTx._id,
        tableNumber: tableInTx.tableNumber,
      };

      // Create Order
      finalOrder = await OrderRepository.create(restaurantId, finalOrderData, { session });

      // Increment coupon usage atomically
      if (couponCode) {
        await CouponService.incrementUsage(couponCode, session);
      }

      // Add Order ID to the table session list
      tableInTx.activeSession.orderIds.push(finalOrder._id);
      await tableInTx.save({ session });
    });

    logger.info(
      { restaurantId, tableNumber: initialTable.tableNumber, orderId: finalOrder._id },
      'Dine-in order placed successfully via QR'
    );

    // 4. Broadcast order_created event in real-time to restaurant's room (KDS)
    socketManager.broadcastToRestaurant(restaurantId, 'order_created', finalOrder);

    // Publish high-throughput notification
    try {
      const NotificationService = require('./notification.service');
      await NotificationService.publish({
        restaurantId,
        targetType: 'role',
        targetId: 'kitchen',
        type: 'ORDER_CREATED',
        title: `🔔 New Order #${finalOrder.orderNumber || finalOrder._id.toString().slice(-4)}`,
        message: `Table ${initialTable.tableNumber} placed a new order of ${validatedItems.length} items (₹${grandTotal.toFixed(2)}).`,
        priority: 'high',
        data: {
          orderId: finalOrder._id,
          tableNumber: initialTable.tableNumber,
          grandTotal,
          itemsCount: validatedItems.length,
        },
        dedupKey: `order_created:${finalOrder._id}`,
      });
    } catch (err) {
      logger.warn({ err }, 'Notification publishing error in placeDineInOrder');
    }

    return finalOrder;
  }
}

module.exports = new TableService();
