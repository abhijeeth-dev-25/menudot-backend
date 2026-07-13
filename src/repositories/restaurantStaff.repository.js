const RestaurantStaff = require('../models/restaurantStaff.model');

class RestaurantStaffRepository {
  /**
   * Creates a new staff membership for a restaurant.
   * @param {string} restaurantId - Target restaurant ID
   * @param {object} staffData - Staff details
   * @returns {Promise<RestaurantStaff>}
   */
  async create(restaurantId, staffData, options = {}) {
    const staff = new RestaurantStaff({
      ...staffData,
      restaurantId,
    });
    return staff.save(options);
  }

  /**
   * Finds a staff member by ID inside a restaurant.
   * @param {string} restaurantId - Target restaurant ID
   * @param {string} id - Staff document ID
   * @returns {Promise<RestaurantStaff|null>}
   */
  async findById(restaurantId, id) {
    return RestaurantStaff.findOne({ _id: id, restaurantId });
  }

  /**
   * Finds a staff membership by user ID inside a restaurant.
   * @param {string} restaurantId - Target restaurant ID
   * @param {string} userId - User ID
   * @returns {Promise<RestaurantStaff|null>}
   */
  async findByUserId(restaurantId, userId) {
    return RestaurantStaff.findOne({ userId, restaurantId });
  }

  /**
   * Finds all staff members associated with a restaurant.
   * @param {string} restaurantId - Target restaurant ID
   * @param {object} [filter={}] - Additional query filters
   * @returns {Promise<RestaurantStaff[]>}
   */
  async findStaffByRestaurant(restaurantId, filter = {}) {
    return RestaurantStaff.find({ ...filter, restaurantId }).populate('userId', 'fullName email mobile');
  }

  /**
   * Finds all restaurant memberships for a given user (cross-tenant lookup).
   * Note: This does not take restaurantId as the first parameter, because it is querying
   * which restaurants a single global user belongs to.
   * @param {string} userId - Target user ID
   * @returns {Promise<RestaurantStaff[]>}
   */
  async findRestaurantsForUser(userId) {
    return RestaurantStaff.find({ userId, status: 'active' }).populate('restaurantId', 'name slug logo');
  }

  /**
   * Updates a staff member's attributes within a restaurant.
   * @param {string} restaurantId - Target restaurant ID
   * @param {string} id - Staff document ID
   * @param {object} updateData - Update values
   * @returns {Promise<RestaurantStaff|null>}
   */
  async update(restaurantId, id, updateData) {
    return RestaurantStaff.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }

  /**
   * Soft deletes a staff member.
   * @param {string} restaurantId - Target restaurant ID
   * @param {string} id - Staff document ID
   * @returns {Promise<RestaurantStaff|null>}
   */
  async delete(restaurantId, id) {
    return RestaurantStaff.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: { isDeleted: true, deletedAt: new Date(), status: 'terminated' } },
      { new: true }
    );
  }
}

module.exports = new RestaurantStaffRepository();
