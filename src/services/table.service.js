const TableRepository = require('../repositories/table.repository');
const Table = require('../models/table.model');
const Restaurant = require('../models/restaurant.model');
const MenuCategory = require('../models/menuCategory.model');
const MenuItem = require('../models/menuItem.model');
const OrderRepository = require('../repositories/order.repository');
const { runTransaction } = require('../utils/transaction');
const socketManager = require('../utils/socket');
const AppError = require('../exceptions/AppError');
const logger = require('../utils/logger');

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
      throw new AppError(403, 'Ordering is currently disabled for this table. Please ask a server to activate it.');
    }

    // 3. Enforce device session lock
    if (table.activeSession) {
      if (table.activeSession.deviceId !== deviceId) {
        throw new AppError(403, 'A customer session is already active at this table. Only one device can order at a time.');
      }
      
      // If same device scans again, renew timestamp and keep session active
      const updatedTable = await TableRepository.update(
        restaurantId,
        table._id,
        { 'activeSession.scannedAt': new Date() }
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
   * Completes table checkout, clears session info, and turns off QR code scanning.
   */
  async checkoutTable(restaurantId, id) {
    const table = await TableRepository.findById(restaurantId, id);
    if (!table) {
      throw new AppError(404, 'Table not found.');
    }

    logger.info({ restaurantId, tableNumber: table.tableNumber }, 'Checking out table session');

    return TableRepository.update(restaurantId, id, {
      status: 'vacant',
      'qrCode.isActive': false,
      activeSession: null,
    });
  }

  /**
   * Helper to fetch restaurant info and active menu tree.
   * Used on customer scans to load everything in 1 payload.
   */
  async _assembleCustomerCatalog(restaurantId, table) {
    const restaurant = await Restaurant.findById(restaurantId).select('name slug location menuProfile');
    const categories = await MenuCategory.find({ restaurantId, status: 'active' }).sort({ sortOrder: 1 });
    const items = await MenuItem.find({ restaurantId, status: 'available' });

    // Group items by categoryId for easy client-side parsing
    const menuTree = categories.map((cat) => {
      const catItems = items.filter((item) => item.categoryId.toString() === cat._id.toString());
      return {
        category: cat,
        items: catItems,
      };
    });

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
    const { code, deviceId, items } = orderData;

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

    const grandTotal = subtotal + totalTax;
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
          discount: 0,
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

    return finalOrder;
  }
}

module.exports = new TableService();
