const Restaurant = require('../models/restaurant.model');

class RestaurantRepository {
  /**
   * Creates a new restaurant document (representing an outlet).
   * @param {object} restaurantData - Restaurant schema attributes
   * @param {object} [options={}] - Query/session options
   * @returns {Promise<Restaurant>} The created restaurant
   */
  async create(restaurantData, options = {}) {
    const restaurant = new Restaurant(restaurantData);
    return restaurant.save(options);
  }

  /**
   * Finds a restaurant by ID.
   * @param {string} id - Restaurant ID
   * @param {object} [options={}] - Query options
   * @returns {Promise<Restaurant|null>}
   */
  async findById(id, options = {}) {
    return Restaurant.findById(id, null, options);
  }

  /**
   * Finds a restaurant by unique slug.
   * @param {string} slug - Unique url slug
   * @returns {Promise<Restaurant|null>}
   */
  async findBySlug(slug) {
    return Restaurant.findOne({ slug });
  }

  /**
   * Updates restaurant information.
   * @param {string} id - Restaurant ID
   * @param {object} updateData - Update attributes
   * @param {object} [options={}] - Query/session options
   * @returns {Promise<Restaurant|null>}
   */
  async update(id, updateData, options = {}) {
    return Restaurant.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true, ...options }
    );
  }

  /**
   * Soft deletes a restaurant.
   * @param {string} id - Restaurant ID
   * @returns {Promise<Restaurant|null>}
   */
  async delete(id) {
    return Restaurant.findByIdAndUpdate(
      id,
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );
  }

  /**
   * List pending onboarding requests (for platform administrators).
   * @returns {Promise<Restaurant[]>}
   */
  async findAllPendingOnboarding() {
    return Restaurant.find({ 'onboarding.stage': 'submitted' }).sort({ 'onboarding.submittedAt': 1 });
  }
}

module.exports = new RestaurantRepository();
