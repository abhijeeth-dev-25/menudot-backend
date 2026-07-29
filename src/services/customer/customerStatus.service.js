const Order = require('../../models/order.model');
const Table = require('../../models/table.model');
const AppError = require('../../exceptions/AppError');
const socketUtil = require('../../utils/socket');

class CustomerStatusService {
  /**
   * Retrieves active order tracking status for customer status page
   */
  static async getOrderStatus(restaurantId, { orderId = null, tableId = null, deviceId = null }) {
    if (!restaurantId) {
      throw new AppError(400, 'Restaurant ID is required');
    }

    let filter = { restaurantId };

    if (orderId) {
      filter._id = orderId;
    } else if (tableId) {
      filter.tableId = tableId;
    } else if (deviceId) {
      filter.deviceId = deviceId;
    } else {
      throw new AppError(400, 'Order ID, Table ID, or Device ID is required');
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();

    if (!orders || orders.length === 0) {
      return {
        activeOrder: null,
        message: 'No active orders found',
      };
    }

    const activeOrder = orders[0];

    // Build deterministic progress steps
    const steps = [
      { key: 'received', label: 'Order Received', isCompleted: true },
      {
        key: 'preparing',
        label: 'Preparing in Kitchen',
        isCompleted: ['preparing', 'ready', 'served', 'completed'].includes(activeOrder.status),
      },
      {
        key: 'ready',
        label: 'Food Plated & Ready',
        isCompleted: ['ready', 'served', 'completed'].includes(activeOrder.status),
      },
      {
        key: 'served',
        label: 'Served to Table',
        isCompleted: ['served', 'completed'].includes(activeOrder.status),
      },
    ];

    return {
      activeOrder: {
        id: activeOrder._id,
        orderNumber: activeOrder.platformOrderId || activeOrder.orderNumber || activeOrder._id.toString(),
        status: activeOrder.status, // 'received' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled'
        platform: activeOrder.platform || activeOrder.orderSource,
        items: activeOrder.items,
        total: (activeOrder.totals && activeOrder.totals.grandTotal) !== undefined ? activeOrder.totals.grandTotal : (activeOrder.totalAmount || activeOrder.total || 0),
        createdAt: activeOrder.createdAt,
        updatedAt: activeOrder.updatedAt,
      },
      progress: {
        currentStep: activeOrder.status,
        steps,
      },
      allOrders: orders.map((o) => ({
        id: o._id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: o.totalAmount || o.total || 0,
      })),
    };
  }

  /**
   * Dispatches real-time table service requests (waiter, bill, water, cleaning)
   */
  static async requestTableService(restaurantId, tableIdentifier, serviceType, note = '') {
    const mongoose = require('mongoose');
    let table;
    if (mongoose.Types.ObjectId.isValid(tableIdentifier)) {
      table = await Table.findOne({ _id: tableIdentifier, ...(restaurantId ? { restaurantId } : {}) });
    }
    if (!table && tableIdentifier) {
      table = await Table.findOne({ 'qrCode.code': tableIdentifier, ...(restaurantId ? { restaurantId } : {}) });
    }
    if (!table && tableIdentifier) {
      table = await Table.findOne({ tableNumber: tableIdentifier, ...(restaurantId ? { restaurantId } : {}) });
    }

    if (!table) {
      throw new AppError(404, 'Table not found');
    }

    restaurantId = restaurantId || table.restaurantId.toString();

    if (!table.qrCode || !table.qrCode.isActive) {
      throw new AppError(403, 'Table session is not active or awaiting staff approval');
    }

    const payload = {
      tableId: table._id,
      tableNumber: table.tableNumber,
      serviceType, // 'water' | 'bill' | 'cleaning' | 'waiter' | 'special'
      note,
      requestedAt: new Date(),
    };

    // Emit real-time WebSockets event to staff room
    if (socketUtil && socketUtil.broadcastToRestaurant) {
      socketUtil.broadcastToRestaurant(restaurantId, 'service_call_received', payload);
    }

    // Publish persistent notification for staff inbox
    try {
      const NotificationService = require('../restaurant/notification.service');
      await NotificationService.publish({
        restaurantId,
        targetType: 'role',
        targetId: 'waiter',
        type: 'SERVICE_CALL',
        title: `👋 Table ${table.tableNumber} Service Request`,
        message: `Table ${table.tableNumber} requested ${serviceType.toUpperCase()} service${note ? `: ${note}` : '.'}`,
        priority: 'urgent',
        data: { tableId: table._id, tableNumber: table.tableNumber, serviceType, note, requestedAt: payload.requestedAt },
        dedupKey: `service_call:${table.tableNumber}:${serviceType}`,
      });
    } catch (err) {
      const logger = require('../../utils/logger');
      logger.warn({ err }, 'Notification publishing error in requestTableService');
    }

    return {
      success: true,
      message: `Staff alerted for ${serviceType} request`,
      payload,
    };
  }
}

module.exports = CustomerStatusService;
