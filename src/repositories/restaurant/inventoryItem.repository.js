const InventoryItem = require('../../models/inventoryItem.model');

class InventoryItemRepository {
  async create(restaurantId, itemData, options = {}) {
    const item = new InventoryItem({
      ...itemData,
      restaurantId,
    });
    return item.save(options);
  }

  async findById(restaurantId, id, options = {}) {
    return InventoryItem.findOne({ _id: id, restaurantId }, null, options);
  }

  async findByName(restaurantId, name) {
    return InventoryItem.findOne({
      restaurantId,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });
  }

  async findAll(restaurantId) {
    return InventoryItem.find({ restaurantId }).sort({ name: 1 });
  }

  async update(restaurantId, id, updateData, options = {}) {
    return InventoryItem.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: updateData },
      { new: true, runValidators: true, ...options }
    );
  }

  async delete(restaurantId, id, options = {}) {
    return InventoryItem.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true, ...options }
    );
  }
}

module.exports = new InventoryItemRepository();
