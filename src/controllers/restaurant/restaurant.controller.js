const RestaurantService = require('../../services/restaurant/restaurant.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../exceptions/AppError');

class RestaurantTenantController {
  /**
   * Get restaurant details (Staff members only).
   */
  getRestaurantDetails = asyncHandler(async (req, res) => {
    const restaurant = await RestaurantService.getRestaurantDetails(req.restaurantId);
    
    const result = restaurant.toJSON();
    
    // Redact sensitive billing/legal/bank credentials for managers, chefs, and servers
    if (req.staff && req.staff.role !== 'owner') {
      if (result.legal) {
        result.legal.pan = '[REDACTED]';
        result.legal.gstin = '[REDACTED]';
        result.legal.fssaiNumber = '[REDACTED]';
      }
      if (result.bank) {
        result.bank.ifsc = '[REDACTED]';
        result.bank.accountNumber = '[REDACTED]';
      }
    }

    return sendSuccess(res, 200, 'Restaurant details retrieved successfully', result);
  });

  /**
   * Update restaurant profile configuration (Owner/Manager only).
   */
  updateRestaurantProfile = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const updated = await RestaurantService.updateRestaurantProfile(restaurantId, req.body);
    return sendSuccess(res, 200, 'Restaurant profile updated successfully.', updated);
  });

  /**
   * Upload restaurant cover image (Owner only).
   */
  uploadRestaurantImage = asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, 'No image file provided. Send a multipart/form-data request with field name "image".');
    }
    const restaurantId = req.restaurantId;
    const updated = await RestaurantService.uploadRestaurantImage(
      restaurantId,
      req.file.buffer,
      req.file.originalname
    );
    return sendSuccess(res, 200, 'Restaurant cover image uploaded successfully.', { imageUrl: updated.imageUrl });
  });
}

module.exports = new RestaurantTenantController();
