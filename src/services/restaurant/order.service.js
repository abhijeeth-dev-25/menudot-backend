const OrderRepository = require('../../repositories/restaurant/order.repository');
const InventoryService = require('./inventory.service');
const AppError = require('../../exceptions/AppError');
const socketManager = require('../../utils/socket');
const logger = require('../../utils/logger');

class OrderService {
  async getOrders(restaurantId, filter = {}) {
    logger.info({ restaurantId, filter }, 'Fetching restaurant orders queue');
    return OrderRepository.findAll(restaurantId, filter);
  }

  /**
   * Updates status of an order and broadcasts live socket event.
   * 
   * @param {string} restaurantId - Owning restaurant
   * @param {string} orderId - Target order
   * @param {string} status - New status ('accepted', 'preparing', 'completed', 'cancelled')
   */
  async updateOrderStatus(restaurantId, orderId, status) {
    const order = await OrderRepository.findById(restaurantId, orderId);
    if (!order) {
      throw new AppError(404, 'Order not found.');
    }

    const oldStatus = order.status;
    const updatedOrder = await OrderRepository.update(restaurantId, orderId, { status });

    logger.info(
      { restaurantId, orderId, oldStatus, newStatus: status },
      'Order status updated successfully'
    );

    // Trigger auto-consumption of raw materials if transitioning to completed status
    if (status === 'completed' && oldStatus !== 'completed') {
      try {
        await InventoryService.consumeInventoryForOrder(restaurantId, orderId);
      } catch (err) {
        logger.error({ err, orderId, restaurantId }, 'Failed to auto-consume inventory for completed order. Continuing.');
      }
    }

    // Broadcast live WebSocket event to restaurant room and table room
    socketManager.broadcastToRestaurant(restaurantId, 'order_updated', updatedOrder);
    if (order.tableId) {
      socketManager.emitToTable(order.tableId.toString(), 'order_updated', updatedOrder);
    }

    // Publish high-throughput durable notification
    try {
      const NotificationService = require('./notification.service');
      await NotificationService.publish({
        restaurantId,
        targetType: 'all',
        type: 'ORDER_STATUS_CHANGED',
        title: `Order #${order.orderNumber || orderId.slice(-4)} Status: ${status.toUpperCase()}`,
        message: `Table ${order.tableNumber || 'Takeaway'} order status changed from ${oldStatus} to ${status}.`,
        priority: status === 'completed' || status === 'cancelled' ? 'high' : 'normal',
        data: { orderId, orderNumber: order.orderNumber, status, tableNumber: order.tableNumber },
        dedupKey: `order_status:${orderId}:${status}`,
      });
    } catch (err) {
      logger.warn({ err }, 'Notification publishing error in order status update');
    }

    return updatedOrder;
  }
}

module.exports = new OrderService();
