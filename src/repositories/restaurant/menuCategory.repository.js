const MenuCategory = require('../../models/menuCategory.model');

class MenuCategoryRepository {
  /**
   * Creates a new menu category.
   * @param {string} restaurantId - The owning restaurant ID
   * @param {object} categoryData - Category schema attributes
   * @param {object} [options={}] - Mongoose transaction/session options
   */
  async create(restaurantId, categoryData, options = {}) {
    const category = new MenuCategory({
      ...categoryData,
      restaurantId,
    });
    return category.save(options);
  }

  /**
   * Finds a category by ID inside a specific restaurant.
   * @param {string} restaurantId - The owning restaurant ID
   * @param {string} id - Category ID
   * @param {object} [options={}] - Mongoose options
   */
  async findById(restaurantId, id, options = {}) {
    return MenuCategory.findOne({ _id: id, restaurantId }, null, options);
  }

  /**
   * Finds a category by slug inside a specific restaurant.
   * @param {string} restaurantId - The owning restaurant ID
   * @param {string} slug - Unique category slug
   */
  async findBySlug(restaurantId, slug) {
    return MenuCategory.findOne({ slug, restaurantId });
  }

  /**
   * Finds a category by name inside a specific restaurant.
   * @param {string} restaurantId - The owning restaurant ID
   * @param {string} name - Category name
   */
  async findByName(restaurantId, name) {
    return MenuCategory.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      restaurantId,
    });
  }

  /**
   * Returns all active categories for a restaurant, sorted by sortOrder.
   * @param {string} restaurantId - The owning restaurant ID
   */
  async findAll(restaurantId) {
    return MenuCategory.find({ restaurantId, status: 'active' }).sort({ sortOrder: 1 });
  }

  /**
   * Updates category attributes.
   * @param {string} restaurantId - The owning restaurant ID
   * @param {string} id - Category ID
   * @param {object} updateData - Update values
   * @param {object} [options={}] - Mongoose options
   */
  async update(restaurantId, id, updateData, options = {}) {
    return MenuCategory.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: updateData },
      { new: true, runValidators: true, ...options }
    );
  }

  /**
   * Soft deletes a category.
   * @param {string} restaurantId - The owning restaurant ID
   * @param {string} id - Category ID
   * @param {object} [options={}] - Mongoose options
   */
  async delete(restaurantId, id, options = {}) {
    return MenuCategory.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true, ...options }
    );
  }
}

module.exports = new MenuCategoryRepository();
