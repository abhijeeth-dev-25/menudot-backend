const OrderService = require('../../services/restaurant/order.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

class OrderController {
  getOrders = asyncHandler(async (req, res) => {
    const { status, orderSource, tableNumber } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (orderSource) filter.orderSource = orderSource;
    if (tableNumber) filter.tableNumber = tableNumber;

    const orders = await OrderService.getOrders(req.restaurantId, filter);
    return sendSuccess(res, 200, 'Orders retrieved successfully', orders);
  });

  updateOrderStatus = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    // req.restaurantId is resolved by resolveTenant
    const order = await OrderService.updateOrderStatus(req.restaurantId, orderId, status);

    return sendSuccess(res, 200, `Order status updated to ${status} successfully`, order);
  });
}

module.exports = new OrderController();
