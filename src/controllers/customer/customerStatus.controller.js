const CustomerStatusService = require('../../services/customer/customerStatus.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

class CustomerStatusController {
  getOrderStatus = asyncHandler(async (req, res) => {
    const restaurantId = req.headers['x-restaurant-id'] || req.query.restaurantId;
    const { orderId, tableId } = req.query;
    const deviceId = req.headers['x-device-id'] || req.query.deviceId;

    const data = await CustomerStatusService.getOrderStatus(restaurantId, {
      orderId,
      tableId,
      deviceId,
    });

    return sendSuccess(res, 200, 'Order tracking status retrieved successfully', data);
  });

  requestTableService = asyncHandler(async (req, res) => {
    const restaurantId = req.headers['x-restaurant-id'] || req.body.restaurantId;
    const { tableId, tableCode, tableNumber, serviceType, note, notes } = req.body;
    const identifier = tableId || tableCode || tableNumber;

    const result = await CustomerStatusService.requestTableService(
      restaurantId,
      identifier,
      serviceType,
      note || notes || ''
    );

    return sendSuccess(res, 200, result.message, result.payload);
  });
}

module.exports = new CustomerStatusController();
