const InventoryService = require('../../services/restaurant/inventory.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

class InventoryController {
  createInventoryItem = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const item = await InventoryService.createInventoryItem(restaurantId, req.body);
    return sendSuccess(res, 201, 'Inventory item created successfully.', item);
  });

  getInventoryItems = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const items = await InventoryService.getInventoryItems(restaurantId);
    return sendSuccess(res, 200, 'Inventory items list retrieved successfully.', items);
  });

  updateInventoryItem = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const { id } = req.params;
    const updated = await InventoryService.updateInventoryItem(restaurantId, id, req.body);
    return sendSuccess(res, 200, 'Inventory item updated successfully.', updated);
  });

  adjustStock = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const { id } = req.params;
    const updated = await InventoryService.adjustStock(restaurantId, id, req.body);
    return sendSuccess(res, 200, 'Stock level adjusted successfully.', updated);
  });
}

module.exports = new InventoryController();
