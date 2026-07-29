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
   * Upload restaurant profile avatar/logo image (Owner only).
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
    return sendSuccess(res, 200, 'Restaurant profile logo image uploaded successfully.', { imageUrl: updated.imageUrl });
  });

  /**
   * Upload restaurant background cover banner image (Owner only).
   */
  uploadRestaurantCoverImage = asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, 'No image file provided. Send a multipart/form-data request with field name "image".');
    }
    const restaurantId = req.restaurantId;
    const updated = await RestaurantService.uploadRestaurantCoverImage(
      restaurantId,
      req.file.buffer,
      req.file.originalname
    );
    return sendSuccess(res, 200, 'Restaurant background cover banner uploaded successfully.', { coverImage: updated.coverImage });
  });

  /**
   * Upload general restaurant media asset (e.g. branch photo, signature dish photo) to ImageKit.
   */
  uploadMediaAsset = asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, 'No image file provided. Send a multipart/form-data request with field name "image".');
    }
    const result = await RestaurantService.uploadMediaAsset(
      req.restaurantId,
      req.file.buffer,
      req.file.originalname
    );
    return sendSuccess(res, 200, 'Media asset uploaded successfully to ImageKit.', result);
  });


  /**
   * Submit formal Legal Amendment Request (Owner only).
   */
  submitLegalRequest = asyncHandler(async (req, res) => {
    const request = await RestaurantService.submitLegalRequest(req.restaurantId, req.user._id, req.body);
    return sendSuccess(res, 201, 'Legal profile amendment request submitted successfully for verification.', request);
  });

  /**
   * Get list of legal amendment requests for restaurant tenant.
   */
  getLegalRequests = asyncHandler(async (req, res) => {
    const requests = await RestaurantService.getLegalRequests(req.restaurantId);
    return sendSuccess(res, 200, 'Legal profile requests retrieved successfully.', requests);
  });

  /**
   * Toggle restaurant operational status (active/open vs inactive/closed).
   */
  toggleRestaurantStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const updated = await RestaurantService.toggleRestaurantStatus(req.restaurantId, status);
    return sendSuccess(res, 200, 'Restaurant operational status updated successfully.', updated);
  });
}

module.exports = new RestaurantTenantController();
