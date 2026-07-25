const CustomerAccountService = require('../../services/customer/customerAccount.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

class CustomerAccountController {
  linkSwiggyAccount = asyncHandler(async (req, res) => {
    const restaurantId = req.headers['x-restaurant-id'] || req.body.restaurantId;
    const deviceId = req.headers['x-device-id'] || req.body.deviceId;
    const { swiggyUserId, swiggyMobile } = req.body;

    const result = await CustomerAccountService.linkSwiggyAccount(restaurantId, {
      deviceId,
      swiggyUserId,
      swiggyMobile,
    });

    return sendSuccess(res, 200, 'Swiggy partner account linked successfully', result);
  });

  getSwiggyStatus = asyncHandler(async (req, res) => {
    const restaurantId = req.headers['x-restaurant-id'] || req.query.restaurantId;
    const deviceId = req.headers['x-device-id'] || req.query.deviceId;

    const status = await CustomerAccountService.getSwiggyStatus(restaurantId, deviceId);
    return sendSuccess(res, 200, 'Swiggy link status retrieved successfully', status);
  });

  getOrderHistory = asyncHandler(async (req, res) => {
    const restaurantId = req.headers['x-restaurant-id'] || req.query.restaurantId;
    const deviceId = req.headers['x-device-id'] || req.query.deviceId;

    const history = await CustomerAccountService.getOrderHistory(restaurantId, deviceId);
    return sendSuccess(res, 200, 'Order history retrieved successfully', history);
  });

  getBillSummary = asyncHandler(async (req, res) => {
    const restaurantId = req.headers['x-restaurant-id'] || req.query.restaurantId;
    const tableId = req.query.tableId || null;
    const deviceId = req.headers['x-device-id'] || req.query.deviceId || null;

    const bill = await CustomerAccountService.getBillSummary(restaurantId, { tableId, deviceId });
    return sendSuccess(res, 200, 'Active bill summary retrieved successfully', bill);
  });
}

module.exports = new CustomerAccountController();
