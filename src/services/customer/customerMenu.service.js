const mongoose = require('mongoose');
const MenuItem = require('../../models/menuItem.model');
const MenuCategory = require('../../models/menuCategory.model');
const AppError = require('../../exceptions/AppError');

function toObjId(id) {
  if (id && typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return id;
}

class CustomerMenuService {
  /**
   * Retrieves full menu catalog grouped by categories
   */
  static async getMenuCatalog(restaurantId, { foodType = null, tableCode = null } = {}) {
    if (!restaurantId) {
      throw new AppError(400, 'Restaurant ID is required');
    }

    const rId = toObjId(restaurantId);

    const categories = await MenuCategory.find({ restaurantId: rId, status: 'active' })
      .sort({ sortOrder: 1 })
      .lean();

    const itemFilter = { restaurantId: rId, status: { $in: ['available', 'out_of_stock'] } };
    if (foodType && foodType !== 'both') {
      itemFilter.foodType = foodType;
    }

    const items = await MenuItem.find(itemFilter).sort({ name: 1 }).lean();

    // Group items under categories
    const categoryMap = new Map();
    categories.forEach((cat) => {
      categoryMap.set(cat._id.toString(), {
        id: cat._id,
        name: cat.name,
        description: cat.description,
        sortOrder: cat.sortOrder,
        items: [],
      });
    });

    // Uncategorized bucket
    const uncategorized = {
      id: 'uncategorized',
      name: 'Other Items',
      description: '',
      sortOrder: 999,
      items: [],
    };

    items.forEach((item) => {
      const formattedItem = {
        id: item._id,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description || '',
        price: item.price,
        foodType: item.foodType, // 'veg' | 'non-veg' | 'egg'
        image: item.image || item.imageUrl || null,
        tags: item.tags || [],
        ingredients: item.ingredients || [],
        status: item.status, // 'available' | 'out_of_stock'
        isAvailable: item.status === 'available',
        taxRate: item.taxRate || 5.0,
        addOnGroups: item.addOnGroups || [],
        ratingsSummary: item.ratingsSummary || { overallRating: 4.8, totalReviews: 12 },
      };

      const catIdStr = item.categoryId ? item.categoryId.toString() : null;
      if (catIdStr && categoryMap.has(catIdStr)) {
        categoryMap.get(catIdStr).items.push(formattedItem);
      } else {
        uncategorized.items.push(formattedItem);
      }
    });

    const resultCategories = Array.from(categoryMap.values()).filter((cat) => cat.items.length > 0);
    if (uncategorized.items.length > 0) {
      resultCategories.push(uncategorized);
    }

    return {
      categories: resultCategories,
      totalItems: items.length,
    };
  }

  /**
   * Search and multi-filter menu items
   */
  static async searchMenu(restaurantId, { q, foodType, categoryId, inStockOnly = false, sortBy = 'relevance' }) {
    if (!restaurantId) {
      throw new AppError(400, 'Restaurant ID is required');
    }

    const rId = toObjId(restaurantId);
    const filter = { restaurantId: rId, status: { $in: ['available', 'out_of_stock'] } };

    if (inStockOnly) {
      filter.status = 'available';
    }

    if (foodType && foodType !== 'both') {
      filter.foodType = foodType;
    }

    if (categoryId) {
      filter.categoryId = toObjId(categoryId);
    }

    if (q && q.trim()) {
      const searchRegex = new RegExp(q.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
        { ingredients: searchRegex },
      ];
    }

    let query = MenuItem.find(filter);

    // Sorting
    if (sortBy === 'price_asc') {
      query = query.sort({ price: 1 });
    } else if (sortBy === 'price_desc') {
      query = query.sort({ price: -1 });
    } else if (sortBy === 'rating') {
      query = query.sort({ 'ratingsSummary.overallRating': -1, name: 1 });
    } else {
      query = query.sort({ name: 1 });
    }

    const items = await query.lean();

    return items.map((item) => ({
      id: item._id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description || '',
      price: item.price,
      foodType: item.foodType,
      image: item.image || item.imageUrl || null,
      tags: item.tags || [],
      ingredients: item.ingredients || [],
      status: item.status,
      isAvailable: item.status === 'available',
      taxRate: item.taxRate || 5.0,
      addOnGroups: item.addOnGroups || [],
      ratingsSummary: item.ratingsSummary || { overallRating: 4.8, totalReviews: 12 },
    }));
  }

  /**
   * Fetch single menu item detail payload
   */
  static async getItemDetails(restaurantId, itemId) {
    const rId = toObjId(restaurantId);
    const item = await MenuItem.findOne({ _id: itemId, restaurantId: rId }).lean();
    if (!item) {
      throw new AppError(404, 'Menu item not found');
    }
    return {
      id: item._id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description || '',
      price: item.price,
      foodType: item.foodType,
      image: item.image || item.imageUrl || null,
      tags: item.tags || [],
      ingredients: item.ingredients || [],
      status: item.status,
      isAvailable: item.status === 'available',
      taxRate: item.taxRate || 5.0,
      addOnGroups: item.addOnGroups || [],
      ratingsSummary: item.ratingsSummary || { overallRating: 4.8, totalReviews: 12 },
    };
  }
}

module.exports = CustomerMenuService;
