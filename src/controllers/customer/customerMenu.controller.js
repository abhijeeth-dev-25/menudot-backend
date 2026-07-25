const CustomerMenuService = require('../../services/customer/customerMenu.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

class CustomerMenuController {
  getMenuCatalog = asyncHandler(async (req, res) => {
    const restaurantId = req.headers['x-restaurant-id'] || req.query.restaurantId;
    const foodType = req.query.foodType || null;

    const data = await CustomerMenuService.getMenuCatalog(restaurantId, { foodType });
    return sendSuccess(res, 200, 'Customer menu catalog retrieved successfully', data);
  });

  searchMenu = asyncHandler(async (req, res) => {
    const restaurantId = req.headers['x-restaurant-id'] || req.query.restaurantId;
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
    const restaurantId = req.headers['x-restaurant-id'] || req.query.restaurantId;
    const { itemId } = req.params;

    const item = await CustomerMenuService.getItemDetails(restaurantId, itemId);
    return sendSuccess(res, 200, 'Menu item detail retrieved successfully', item);
  });
}

module.exports = new CustomerMenuController();
