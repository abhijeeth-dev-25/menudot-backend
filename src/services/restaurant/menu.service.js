const MenuCategoryRepository = require('../../repositories/restaurant/menuCategory.repository');
const MenuItemRepository = require('../../repositories/restaurant/menuItem.repository');
const MediaAssetRepository = require('../../repositories/restaurant/mediaAsset.repository');
const MediaAsset = require('../../models/mediaAsset.model'); // Import model directly for simple queries
const MenuItem = require('../../models/menuItem.model'); // Import model directly for bulk updates
const AppError = require('../../exceptions/AppError');
const { uploadImage, deleteImage } = require('../../utils/imagekit');
const { runTransaction } = require('../../utils/transaction');

class MenuService {
  // ==========================================
  // CATEGORY OPERATIONS
  // ==========================================

  async createCategory(restaurantId, categoryData) {
    const { name } = categoryData;

    // Check if category name already exists
    const existingName = await MenuCategoryRepository.findByName(restaurantId, name);
    if (existingName) {
      throw new AppError(400, `A category with the name "${name}" already exists.`);
    }

    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const existingSlug = await MenuCategoryRepository.findBySlug(restaurantId, slug);
    if (existingSlug) {
      throw new AppError(400, 'A category with a similar name/slug already exists.');
    }

    return MenuCategoryRepository.create(restaurantId, {
      ...categoryData,
      slug,
    });
  }

  async getCategories(restaurantId) {
    return MenuCategoryRepository.findAll(restaurantId);
  }

  async updateCategory(restaurantId, id, updateData) {
    const category = await MenuCategoryRepository.findById(restaurantId, id);
    if (!category) {
      throw new AppError(404, 'Category not found.');
    }

    const updates = { ...updateData };

    if (updateData.name && updateData.name !== category.name) {
      const existingName = await MenuCategoryRepository.findByName(restaurantId, updateData.name);
      if (existingName) {
        throw new AppError(400, `A category with the name "${updateData.name}" already exists.`);
      }

      const slug = updateData.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

      const existingSlug = await MenuCategoryRepository.findBySlug(restaurantId, slug);
      if (existingSlug) {
        throw new AppError(400, 'A category with a similar name/slug already exists.');
      }

      updates.slug = slug;
    }

    return MenuCategoryRepository.update(restaurantId, id, updates);
  }

  async deleteCategory(restaurantId, id) {
    const category = await MenuCategoryRepository.findById(restaurantId, id);
    if (!category) {
      throw new AppError(404, 'Category not found.');
    }

    // Atomically soft-delete category AND all its items
    await runTransaction(async (session) => {
      await MenuCategoryRepository.delete(restaurantId, id, { session });
      
      // Bulk soft-delete menu items under this category
      await MenuItem.updateMany(
        { categoryId: id, restaurantId, isDeleted: false },
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { session }
      );
    });

    return { message: 'Category and all associated menu items successfully deleted.' };
  }

  // ==========================================
  // ITEM OPERATIONS
  // ==========================================

  async createItem(restaurantId, itemData) {
    const { name, categoryId } = itemData;

    // Check if category exists and is valid
    const category = await MenuCategoryRepository.findById(restaurantId, categoryId);
    if (!category) {
      throw new AppError(400, 'Invalid category selected. Category does not exist.');
    }

    // Check unique item name per restaurant
    const existingItem = await MenuItemRepository.findByName(restaurantId, name);
    if (existingItem) {
      throw new AppError(400, `A menu item with the name "${name}" already exists.`);
    }

    return MenuItemRepository.create(restaurantId, itemData);
  }

  async getItems(restaurantId, filter = {}) {
    return MenuItemRepository.findAll(restaurantId, filter);
  }

  async getItemDetails(restaurantId, id) {
    const item = await MenuItemRepository.findById(restaurantId, id);
    if (!item) {
      throw new AppError(404, 'Menu item not found.');
    }
    return item;
  }

  async updateItem(restaurantId, id, updateData) {
    const item = await MenuItemRepository.findById(restaurantId, id);
    if (!item) {
      throw new AppError(404, 'Menu item not found.');
    }

    const updates = { ...updateData };

    if (updateData.name && updateData.name !== item.name) {
      const existingItem = await MenuItemRepository.findByName(restaurantId, updateData.name);
      if (existingItem) {
        throw new AppError(400, `A menu item with the name "${updateData.name}" already exists.`);
      }
    }

    if (updateData.categoryId && updateData.categoryId !== item.categoryId.toString()) {
      const category = await MenuCategoryRepository.findById(restaurantId, updateData.categoryId);
      if (!category) {
        throw new AppError(400, 'Invalid category selected. Category does not exist.');
      }
    }

    return MenuItemRepository.update(restaurantId, id, updates);
  }

  async deleteItem(restaurantId, id) {
    const item = await MenuItemRepository.findById(restaurantId, id);
    if (!item) {
      throw new AppError(404, 'Menu item not found.');
    }

    // If item has an image, search if it maps to any media assets to delete from ImageKit
    if (item.image) {
      const asset = await MediaAsset.findOne({ url: item.image, restaurantId });
      if (asset) {
        await deleteImage(asset.fileId);
        await MediaAssetRepository.delete(restaurantId, asset._id);
      }
    }

    return MenuItemRepository.delete(restaurantId, id);
  }

  async toggleStockStatus(restaurantId, id, status) {
    const item = await MenuItemRepository.findById(restaurantId, id);
    if (!item) {
      throw new AppError(404, 'Menu item not found.');
    }
    return MenuItemRepository.update(restaurantId, id, { status });
  }

  // ==========================================
  // MEDIA OPERATIONS
  // ==========================================

  async uploadMedia(restaurantId, fileBuffer, originalName, size) {
    // 1. Upload to ImageKit (or local fallback)
    const { url, fileId } = await uploadImage(fileBuffer, originalName);

    // 2. Track asset in database
    return MediaAssetRepository.create(restaurantId, {
      url,
      fileId,
      filename: originalName,
      size,
    });
  }
}

module.exports = new MenuService();
