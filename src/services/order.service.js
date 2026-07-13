const OrderRepository = require('../repositories/order.repository');
const AppError = require('../exceptions/AppError');
const socketManager = require('../utils/socket');
const logger = require('../utils/logger');

class OrderService {
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

    // Broadcast live WebSocket event to restaurant room
    socketManager.broadcastToRestaurant(restaurantId, 'order_updated', updatedOrder);

    return updatedOrder;
  }
}

module.exports = new OrderService();
