const Order = require('../../models/order.model');

class OrderRepository {
  /**
   * Creates a new order.
   * @param {string} restaurantId - The owning restaurant ID
   * @param {object} orderData - Order attributes
   * @param {object} [options={}] - Mongoose transaction/session options
   */
  async create(restaurantId, orderData, options = {}) {
    const order = new Order({
      ...orderData,
      restaurantId,
    });
    return order.save(options);
  }

  /**
   * Finds an order by ID.
   * @param {string} restaurantId - The owning restaurant ID
   * @param {string} id - Order ID
   * @param {object} [options={}] - Mongoose options
   */
  async findById(restaurantId, id, options = {}) {
    return Order.findOne({ _id: id, restaurantId }, null, options);
  }

  /**
   * Finds an order by its unique platform order ID (e.g. Swiggy/Zomato ID).
   * Used to check for duplicate webhook requests.
   * @param {string} restaurantId - The owning restaurant ID
   * @param {string} orderSource - 'swiggy', 'zomato', etc.
   * @param {string} platformOrderId - External order ID
   */
  async findByPlatformOrderId(restaurantId, orderSource, platformOrderId) {
    return Order.findOne({ restaurantId, orderSource, platformOrderId });
  }

  /**
   * Lists orders for a restaurant based on filters.
   * @param {string} restaurantId - The owning restaurant ID
   * @param {object} [filter={}] - Query filters (e.g. status, orderSource)
   */
  async findAll(restaurantId, filter = {}) {
    const query = { ...filter, restaurantId };
    return Order.find(query).sort({ createdAt: -1 });
  }

  /**
   * Updates order status or other details.
   * @param {string} restaurantId - The owning restaurant ID
   * @param {string} id - Order ID
   * @param {object} updateData - Update values
   * @param {object} [options={}] - Mongoose options
   */
  async update(restaurantId, id, updateData, options = {}) {
    return Order.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: updateData },
      { new: true, runValidators: true, ...options }
    );
  }
}

module.exports = new OrderRepository();
