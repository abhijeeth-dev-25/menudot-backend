const mongoose = require('mongoose');
const CustomerMenuService = require('../../services/customer/customerMenu.service');
const Table = require('../../models/table.model');
const Restaurant = require('../../models/restaurant.model');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

async function resolveRestaurantId(req) {
  let restaurantId = req.headers['x-restaurant-id'] || req.query.restaurantId;
  if (restaurantId && restaurantId !== 'undefined' && restaurantId !== 'null') {
    return restaurantId;
  }

  const tableCode = req.query.tableCode || req.headers['x-table-code'];
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

class CustomerMenuController {
  getMenuCatalog = asyncHandler(async (req, res) => {
    const restaurantId = await resolveRestaurantId(req);
    const foodType = req.query.foodType || null;

    const data = await CustomerMenuService.getMenuCatalog(restaurantId, { foodType });
    return sendSuccess(res, 200, 'Customer menu catalog retrieved successfully', data);
  });

  searchMenu = asyncHandler(async (req, res) => {
    const restaurantId = await resolveRestaurantId(req);
    const { q, foodType, categoryId, inStockOnly, sortBy } = req.query;

    const items = await CustomerMenuService.searchMenu(restaurantId, {
      q,
      foodType,
      categoryId,
      inStockOnly: inStockOnly === 'true',
      sortBy,
    });

    return sendSuccess(res, 200, 'Search results retrieved successfully', {
      query: q || '',
      total: items.length,
      items,
    });
  });

  getItemDetails = asyncHandler(async (req, res) => {
    const restaurantId = await resolveRestaurantId(req);
    const { itemId } = req.params;

    const item = await CustomerMenuService.getItemDetails(restaurantId, itemId);
    return sendSuccess(res, 200, 'Menu item detail retrieved successfully', item);
  });
}

module.exports = new CustomerMenuController();
