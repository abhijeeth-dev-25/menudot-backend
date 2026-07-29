const mongoose = require('mongoose');
const CustomerHomeService = require('../../services/customer/customerHome.service');
const Table = require('../../models/table.model');
const Restaurant = require('../../models/restaurant.model');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

async function resolveRestaurantId(req, tableCode) {
  let restaurantId = req.headers['x-restaurant-id'] || req.query.restaurantId;
  if (restaurantId && restaurantId !== 'undefined' && restaurantId !== 'null') {
    return restaurantId;
  }

  if (tableCode) {
    let tableQuery = { 'qrCode.code': tableCode };
    if (mongoose.Types.ObjectId.isValid(tableCode)) {
      tableQuery = { $or: [{ _id: new mongoose.Types.ObjectId(tableCode) }, { 'qrCode.code': tableCode }, { tableNumber: tableCode }] };
    } else {
      tableQuery = { $or: [{ 'qrCode.code': tableCode }, { tableNumber: tableCode }] };
    }
    const table = await Table.findOne(tableQuery).select('restaurantId').lean();
    if (table && table.restaurantId) {
      return table.restaurantId;
    }
  }

  const firstRest = await Restaurant.findOne({}).select('_id').lean();
  return firstRest ? firstRest._id : null;
}

class CustomerHomeController {
  getHomeFeed = asyncHandler(async (req, res) => {
    const tableCode = req.query.tableCode || req.query.code || null;
    const deviceId = req.headers['x-device-id'] || req.query.deviceId || null;
    const restaurantId = await resolveRestaurantId(req, tableCode);

    const data = await CustomerHomeService.getHomeFeed(restaurantId, tableCode, deviceId);
    return sendSuccess(res, 200, 'Customer home feed retrieved successfully', data);
  });

  getExperienceServices = asyncHandler(async (req, res) => {
    const restaurantId = await resolveRestaurantId(req, req.query.tableCode);
    const category = req.query.category || null;

    const services = await CustomerHomeService.getExperienceServices(restaurantId, category);
    return sendSuccess(res, 200, 'Experience services retrieved successfully', services);
  });

  getBranches = asyncHandler(async (req, res) => {
    const restaurantId = await resolveRestaurantId(req, req.query.tableCode);

    const branches = await CustomerHomeService.getBranches(restaurantId);
    return sendSuccess(res, 200, 'Outlets and branches retrieved successfully', branches);
  });
}

module.exports = new CustomerHomeController();
