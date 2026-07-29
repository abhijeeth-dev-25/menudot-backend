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
   * Uploads restaurant profile avatar image to ImageKit and saves URL to profile.
   */
  async uploadRestaurantImage(restaurantId, fileBuffer, originalName) {
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant profile not found.');
    }

    const { url } = await uploadImage(fileBuffer, `restaurant_avatar_${restaurantId}_${originalName}`);
    const updated = await RestaurantRepository.update(restaurantId, { imageUrl: url });
    logger.info({ restaurantId, url }, 'Restaurant profile logo avatar uploaded successfully');
    return updated;
  }

  /**
   * Uploads restaurant background cover banner image to ImageKit and saves URL to profile.
   */
  async uploadRestaurantCoverImage(restaurantId, fileBuffer, originalName) {
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant profile not found.');
    }

    const { url } = await uploadImage(fileBuffer, `restaurant_cover_${restaurantId}_${originalName}`);
    const updated = await RestaurantRepository.update(restaurantId, { coverImage: url });
    logger.info({ restaurantId, url }, 'Restaurant background cover banner uploaded successfully');
    return updated;
  }

  /**
   * Uploads any general restaurant media asset (branch photo, signature dish photo) to ImageKit.
   */
  async uploadMediaAsset(restaurantId, fileBuffer, originalName) {
    const { url, fileId } = await uploadImage(fileBuffer, `restaurant_asset_${restaurantId}_${originalName}`);
    logger.info({ restaurantId, url }, 'Restaurant media asset uploaded successfully to ImageKit');
    return { url, fileId };
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

  /**
   * Creates a formal Legal Profile Amendment Request for SOC2/GST/FSSAI compliance review.
   */
  async submitLegalRequest(restaurantId, userId, payload) {
    const LegalRequest = require('../../models/legalRequest.model');
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant profile not found.');
    }

    const { requestType, reason, requestedValues, documentProofUrls } = payload;
    if (!requestType || !reason || !requestedValues) {
      throw new AppError(400, 'Missing request type, reason, or target requested values.');
    }

    const currentValues = {
      legalName: restaurant.name,
      pan: restaurant.legal?.pan || '',
      gstin: restaurant.legal?.gstin || '',
      fssaiNumber: restaurant.legal?.fssaiNumber || '',
      bankAccount: restaurant.bank?.accountNumber || '',
      ifsc: restaurant.bank?.ifsc || '',
    };

    const legalReq = new LegalRequest({
      restaurantId,
      requestedBy: userId,
      requestType,
      reason,
      currentValues,
      requestedValues,
      documentProofUrls: documentProofUrls || [],
      status: 'pending_verification',
    });

    await legalReq.save();
    logger.info({ restaurantId, legalReqId: legalReq._id }, 'Formal legal amendment request submitted for verification');
    return legalReq;
  }

  /**
   * Fetches status of all legal amendment requests submitted for the tenant.
   */
  async getLegalRequests(restaurantId) {
    const LegalRequest = require('../../models/legalRequest.model');
    return await LegalRequest.find({ restaurantId }).sort({ createdAt: -1 });
  }

  /**
   * Toggles restaurant operational status (active/open vs inactive/closed).
   */
  async toggleRestaurantStatus(restaurantId, status) {
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant profile not found.');
    }

    const updated = await RestaurantRepository.update(restaurantId, { status });
    logger.info({ restaurantId, status }, 'Restaurant operational status updated');
    return updated;
  }
}

module.exports = new RestaurantTenantService();
