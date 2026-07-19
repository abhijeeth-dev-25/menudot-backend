const MenuService = require('../../services/restaurant/menu.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../exceptions/AppError');

class MenuController {
  // ==========================================
  // CATEGORY ACTIONS
  // ==========================================

  createCategory = asyncHandler(async (req, res) => {
    // req.restaurantId is populated by resolveTenant middleware
    const category = await MenuService.createCategory(req.restaurantId, req.body);
    return sendSuccess(res, 201, 'Menu category created successfully', category);
  });

  getCategories = asyncHandler(async (req, res) => {
    const categories = await MenuService.getCategories(req.restaurantId);
    return sendSuccess(res, 200, 'Categories retrieved successfully', categories);
  });

  updateCategory = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const category = await MenuService.updateCategory(req.restaurantId, categoryId, req.body);
    return sendSuccess(res, 200, 'Menu category updated successfully', category);
  });

  deleteCategory = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const result = await MenuService.deleteCategory(req.restaurantId, categoryId);
    return sendSuccess(res, 200, result.message);
  });

  // ==========================================
  // ITEM ACTIONS
  // ==========================================

  createItem = asyncHandler(async (req, res) => {
    const item = await MenuService.createItem(req.restaurantId, req.body);
    return sendSuccess(res, 201, 'Menu item created successfully', item);
  });

  getItems = asyncHandler(async (req, res) => {
    // Optional filter by categoryId or foodType from query params
    const filter = {};
    if (req.query.categoryId) filter.categoryId = req.query.categoryId;
    if (req.query.foodType) filter.foodType = req.query.foodType;
    if (req.query.status) filter.status = req.query.status;

    const items = await MenuService.getItems(req.restaurantId, filter);
    return sendSuccess(res, 200, 'Menu items retrieved successfully', items);
  });

  getItemDetails = asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    const item = await MenuService.getItemDetails(req.restaurantId, itemId);
    return sendSuccess(res, 200, 'Menu item details retrieved successfully', item);
  });

  updateItem = asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    const item = await MenuService.updateItem(req.restaurantId, itemId, req.body);
    return sendSuccess(res, 200, 'Menu item updated successfully', item);
  });

  deleteItem = asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    await MenuService.deleteItem(req.restaurantId, itemId);
    return sendSuccess(res, 200, 'Menu item deleted successfully');
  });

  toggleStockStatus = asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    const { status } = req.body;
    const item = await MenuService.toggleStockStatus(req.restaurantId, itemId, status);
    return sendSuccess(res, 200, `Stock status updated to ${status}`, item);
  });

  // ==========================================
  // MEDIA ACTIONS
  // ==========================================

  uploadMedia = asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, 'No image file uploaded.');
    }

    const asset = await MenuService.uploadMedia(
      req.restaurantId,
      req.file.buffer,
      req.file.originalname,
      req.file.size
    );

    return sendSuccess(res, 201, 'Image uploaded successfully', asset);
  });
}

module.exports = new MenuController();
