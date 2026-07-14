const InventoryItemRepository = require('../repositories/inventoryItem.repository');
const InventoryTransactionRepository = require('../repositories/inventoryTransaction.repository');
const MenuItem = require('../models/menuItem.model');
const Order = require('../models/order.model');
const AppError = require('../exceptions/AppError');
const logger = require('../utils/logger');
const { runTransaction } = require('../utils/transaction');

class InventoryService {
  /**
   * Creates a new inventory item.
   */
  async createInventoryItem(restaurantId, data) {
    const existing = await InventoryItemRepository.findByName(restaurantId, data.name);
    if (existing) {
      throw new AppError(400, `Inventory item "${data.name}" already exists.`);
    }

    const item = await InventoryItemRepository.create(restaurantId, data);
    logger.info({ itemId: item._id, restaurantId }, 'Inventory item created successfully');
    return item;
  }

  /**
   * Retrieves all inventory items for a restaurant.
   */
  async getInventoryItems(restaurantId) {
    return InventoryItemRepository.findAll(restaurantId);
  }

  /**
   * Updates an inventory item's properties.
   */
  async updateInventoryItem(restaurantId, id, updateData) {
    const item = await InventoryItemRepository.findById(restaurantId, id);
    if (!item) {
      throw new AppError(404, 'Inventory item not found.');
    }

    if (updateData.name) {
      const existing = await InventoryItemRepository.findByName(restaurantId, updateData.name);
      if (existing && existing._id.toString() !== id) {
        throw new AppError(400, `Inventory item "${updateData.name}" already exists.`);
      }
    }

    const updated = await InventoryItemRepository.update(restaurantId, id, updateData);
    logger.info({ itemId: id, restaurantId }, 'Inventory item updated successfully');
    return updated;
  }

  /**
   * Manually adjusts stock levels (purchase, wastage, adjustment) and registers transaction.
   */
  async adjustStock(restaurantId, id, adjustData) {
    const { type, quantity, reason } = adjustData;

    return runTransaction(async (session) => {
      const item = await InventoryItemRepository.findById(restaurantId, id, { session });
      if (!item) {
        throw new AppError(404, 'Inventory item not found.');
      }

      let newStock = item.currentStock;

      if (type === 'purchase') {
        newStock += quantity;
      } else if (type === 'wastage') {
        newStock -= quantity;
      } else if (type === 'adjustment') {
        // Adjustments can be positive (add) or negative (subtract)
        newStock += quantity;
      }

      if (newStock < 0) {
        throw new AppError(
          400,
          `Insufficient stock for adjustment. Current stock: ${item.currentStock}, attempted change: ${quantity}`
        );
      }

      // Update currentStock
      const updatedItem = await InventoryItemRepository.update(
        restaurantId,
        id,
        { currentStock: newStock },
        { session }
      );

      // Create transaction record
      await InventoryTransactionRepository.create(
        restaurantId,
        {
          inventoryItemId: id,
          type,
          quantity: Math.abs(quantity),
          reason: reason || 'Manual stock adjustment',
        },
        { session }
      );

      logger.info(
        { itemId: id, restaurantId, type, change: quantity, newStock },
        'Manual stock adjustment processed successfully'
      );

      return updatedItem;
    });
  }

  /**
   * Automatically consumes ingredients for a completed order based on recipes.
   */
  async consumeInventoryForOrder(restaurantId, orderId, session = null) {
    logger.info({ orderId, restaurantId }, 'Triggering automatic recipe inventory consumption pipeline');

    const order = await Order.findOne({ _id: orderId, restaurantId }, null, { session });
    if (!order) {
      logger.error({ orderId, restaurantId }, 'Order not found for recipe inventory consumption');
      return;
    }

    for (const cartItem of order.items) {
      const menuItem = await MenuItem.findOne({ _id: cartItem.itemId, restaurantId }, null, { session });
      if (!menuItem || !menuItem.recipe || menuItem.recipe.length === 0) {
        continue; // No recipe mapped, skip
      }

      for (const ingredient of menuItem.recipe) {
        const totalNeeded = ingredient.quantityRequired * cartItem.quantity;

        const inventoryItem = await InventoryItemRepository.findById(
          restaurantId,
          ingredient.inventoryItemId,
          { session }
        );

        if (!inventoryItem) {
          logger.warn(
            { ingredientId: ingredient.inventoryItemId, menuItem: menuItem.name },
            'Recipe references inventory item that no longer exists. Skipping.'
          );
          continue;
        }

        const newStock = Math.max(0, inventoryItem.currentStock - totalNeeded);

        // Update Stock
        await InventoryItemRepository.update(
          restaurantId,
          inventoryItem._id,
          { currentStock: newStock },
          { session }
        );

        // Log transaction
        await InventoryTransactionRepository.create(
          restaurantId,
          {
            inventoryItemId: inventoryItem._id,
            type: 'consumption',
            quantity: totalNeeded,
            reason: `Order #${order.orderNumber} completion`,
            recordedAt: new Date(),
          },
          { session }
        );

        // Threshold check alerts
        if (newStock <= inventoryItem.reorderThreshold) {
          logger.warn(
            {
              restaurantId,
              itemId: inventoryItem._id,
              itemName: inventoryItem.name,
              currentStock: newStock,
              threshold: inventoryItem.reorderThreshold,
            },
            `LOW STOCK WARNING: Inventory item "${inventoryItem.name}" has fallen below reorder threshold.`
          );
        }
      }
    }
  }
}

module.exports = new InventoryService();
