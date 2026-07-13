const Screen = require('../models/screen.model');

class ScreenRepository {
  /**
   * Creates a new screen device config.
   * @param {string} restaurantId - Target restaurant ID
   * @param {object} screenData - Screen attributes
   * @returns {Promise<Screen>}
   */
  async create(restaurantId, screenData) {
    const screen = new Screen({
      ...screenData,
      restaurantId,
    });
    return screen.save();
  }

  /**
   * Finds a screen by ID.
   * @param {string} restaurantId - Target restaurant ID
   * @param {string} id - Screen ID
   * @returns {Promise<Screen|null>}
   */
  async findById(restaurantId, id) {
    return Screen.findOne({ _id: id, restaurantId });
  }

  /**
   * Finds a screen by its unique username inside a restaurant.
   * @param {string} restaurantId - Target restaurant ID
   * @param {string} username - Screen username
   * @returns {Promise<Screen|null>}
   */
  async findByUsername(restaurantId, username) {
    return Screen.findOne({ username, restaurantId });
  }

  /**
   * Lists all screens in a restaurant.
   * @param {string} restaurantId - Target restaurant ID
   * @returns {Promise<Screen[]>}
   */
  async findAllByRestaurant(restaurantId) {
    return Screen.find({ restaurantId });
  }

  /**
   * Updates screen status/info.
   * @param {string} restaurantId - Target restaurant ID
   * @param {string} id - Screen ID
   * @param {object} updateData - Update values
   * @returns {Promise<Screen|null>}
   */
  async update(restaurantId, id, updateData) {
    return Screen.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }

  /**
   * Soft deletes a screen.
   * @param {string} restaurantId - Target restaurant ID
   * @param {string} id - Screen ID
   * @returns {Promise<Screen|null>}
   */
  async delete(restaurantId, id) {
    return Screen.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: { isDeleted: true, deletedAt: new Date(), status: 'inactive' } },
      { new: true }
    );
  }
}

module.exports = new ScreenRepository();
