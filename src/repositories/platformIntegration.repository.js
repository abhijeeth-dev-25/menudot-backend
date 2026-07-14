const PlatformIntegration = require('../models/platformIntegration.model');

class PlatformIntegrationRepository {
  /**
   * Creates a new platform integration configuration.
   * @param {string} restaurantId - Owning restaurant ID
   * @param {object} integrationData - Details
   * @param {object} [options={}] - Mongoose transaction/session options
   */
  async create(restaurantId, integrationData, options = {}) {
    const integration = new PlatformIntegration({
      ...integrationData,
      restaurantId,
    });
    return integration.save(options);
  }

  /**
   * Finds a platform integration by platform name.
   * @param {string} restaurantId - Owning restaurant ID
   * @param {string} platform - swiggy, zomato, or magicpin
   */
  async findByPlatform(restaurantId, platform) {
    return PlatformIntegration.findOne({ restaurantId, platform });
  }

  /**
   * Finds a platform integration by ID.
   * @param {string} restaurantId - Owning restaurant ID
   * @param {string} id - Integration ID
   * @param {object} [options={}] - Mongoose options
   */
  async findById(restaurantId, id, options = {}) {
    return PlatformIntegration.findOne({ _id: id, restaurantId }, null, options);
  }

  /**
   * Lists all integrations configured for a restaurant.
   * @param {string} restaurantId - Owning restaurant ID
   */
  async findAll(restaurantId) {
    return PlatformIntegration.find({ restaurantId }).sort({ platform: 1 });
  }

  /**
   * Updates an integration configuration.
   * @param {string} restaurantId - Owning restaurant ID
   * @param {string} id - Integration ID
   * @param {object} updateData - Updated values
   * @param {object} [options={}] - Mongoose options
   */
  async update(restaurantId, id, updateData, options = {}) {
    return PlatformIntegration.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: updateData },
      { new: true, runValidators: true, ...options }
    );
  }

  /**
   * Soft deletes an integration configuration.
   * @param {string} restaurantId - Owning restaurant ID
   * @param {string} id - Integration ID
   * @param {object} [options={}] - Mongoose options
   */
  async delete(restaurantId, id, options = {}) {
    return PlatformIntegration.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true, ...options }
    );
  }
}

module.exports = new PlatformIntegrationRepository();
