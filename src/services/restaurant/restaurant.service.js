const RestaurantRepository = require('../../repositories/restaurant/restaurant.repository');
const AppError = require('../../exceptions/AppError');
const { uploadImage } = require('../../utils/imagekit');
const logger = require('../../utils/logger');

class RestaurantTenantService {
  /**
   * Fetch restaurant configuration profile.
   * @param {string} restaurantId - The target restaurant
   */
  async getRestaurantDetails(restaurantId) {
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant profile not found.');
    }
    return restaurant;
  }

  /**
   * Uploads restaurant cover image to ImageKit and saves URL to profile.
   */
  async uploadRestaurantImage(restaurantId, fileBuffer, originalName) {
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant profile not found.');
    }

    const { url } = await uploadImage(fileBuffer, `restaurant_${restaurantId}_${originalName}`);
    const updated = await RestaurantRepository.update(restaurantId, { imageUrl: url });
    logger.info({ restaurantId, url }, 'Restaurant cover image uploaded successfully');
    return updated;
  }

  /**
   * Updates restaurant profile configuration (Owner/Manager only).
   */
  async updateRestaurantProfile(restaurantId, updateData) {
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant profile not found.');
    }

    const updated = await RestaurantRepository.update(restaurantId, updateData);
    logger.info({ restaurantId }, 'Restaurant profile updated successfully');
    return updated;
  }
}

module.exports = new RestaurantTenantService();
