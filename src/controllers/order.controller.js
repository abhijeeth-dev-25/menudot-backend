const OrderService = require('../services/order.service');
const { sendSuccess } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

class OrderController {
  updateOrderStatus = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;
    
    // req.restaurantId is resolved by resolveTenant
    const order = await OrderService.updateOrderStatus(req.restaurantId, orderId, status);
    
    return sendSuccess(res, 200, `Order status updated to ${status} successfully`, order);
  });
}

module.exports = new OrderController();
