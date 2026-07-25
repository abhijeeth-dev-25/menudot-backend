const CustomerHomeService = require('../../services/customer/customerHome.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

class CustomerHomeController {
  getHomeFeed = asyncHandler(async (req, res) => {
    const restaurantId = req.headers['x-restaurant-id'] || req.query.restaurantId;
    const tableCode = req.query.tableCode || req.query.code || null;
    const deviceId = req.headers['x-device-id'] || req.query.deviceId || null;

    const data = await CustomerHomeService.getHomeFeed(restaurantId, tableCode, deviceId);
    return sendSuccess(res, 200, 'Customer home feed retrieved successfully', data);
  });

  getExperienceServices = asyncHandler(async (req, res) => {
    const restaurantId = req.headers['x-restaurant-id'] || req.query.restaurantId;
    const category = req.query.category || null;

    const services = await CustomerHomeService.getExperienceServices(restaurantId, category);
    return sendSuccess(res, 200, 'Experience services retrieved successfully', services);
  });

  getBranches = asyncHandler(async (req, res) => {
    const restaurantId = req.headers['x-restaurant-id'] || req.query.restaurantId;

    const branches = await CustomerHomeService.getBranches(restaurantId);
    return sendSuccess(res, 200, 'Outlets and branches retrieved successfully', branches);
  });
}

module.exports = new CustomerHomeController();
