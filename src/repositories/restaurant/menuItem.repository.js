const MenuItem = require('../../models/menuItem.model');

class MenuItemRepository {
  /**
   * Creates a new menu item.
   * @param {string} restaurantId - Owning restaurant
   * @param {object} itemData - Item schema attributes
   * @param {object} [options={}] - Mongoose transaction/session options
   */
  async create(restaurantId, itemData, options = {}) {
    const item = new MenuItem({
      ...itemData,
      restaurantId,
    });
    return item.save(options);
  }

  /**
   * Finds a menu item by ID inside a specific restaurant.
   * @param {string} restaurantId - Owning restaurant
   * @param {string} id - Menu item ID
   * @param {object} [options={}] - Mongoose options
   */
  async findById(restaurantId, id, options = {}) {
    return MenuItem.findOne({ _id: id, restaurantId }, null, options).populate('categoryId', 'name slug');
  }

  /**
   * Finds a menu item by name (case-insensitive) inside a specific restaurant.
   * @param {string} restaurantId - Owning restaurant
   * @param {string} name - Item name
   */
  async findByName(restaurantId, name) {
    return MenuItem.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      restaurantId,
    });
  }

  /**
   * Lists all menu items inside a specific restaurant matching filters.
   * @param {string} restaurantId - Owning restaurant
   * @param {object} [filter={}] - Query filters (e.g. categoryId, status, foodType)
   */
  async findAll(restaurantId, filter = {}) {
    const query = { ...filter, restaurantId };
    return MenuItem.find(query).populate('categoryId', 'name slug');
  }

  /**
   * Lists all menu items under a category inside a specific restaurant.
   * @param {string} restaurantId - Owning restaurant
   * @param {string} categoryId - Category ID
   */
  async findByCategory(restaurantId, categoryId) {
    return MenuItem.find({ restaurantId, categoryId, status: 'available' });
  }

  /**
   * Updates menu item attributes.
   * @param {string} restaurantId - Owning restaurant
   * @param {string} id - Menu item ID
   * @param {object} updateData - Update values
   * @param {object} [options={}] - Mongoose options
   */
  async update(restaurantId, id, updateData, options = {}) {
    return MenuItem.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: updateData },
      { new: true, runValidators: true, ...options }
    );
  }

  /**
   * Soft deletes a menu item.
   * @param {string} restaurantId - Owning restaurant
   * @param {string} id - Menu item ID
   * @param {object} [options={}] - Mongoose options
   */
  async delete(restaurantId, id, options = {}) {
    return MenuItem.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true, ...options }
    );
  }
}

module.exports = new MenuItemRepository();
