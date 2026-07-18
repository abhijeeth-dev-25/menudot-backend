const RestaurantService = require('../services/restaurant.service');
const { sendSuccess } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../exceptions/AppError');

class RestaurantController {
  /**
   * Review restaurant application (Platform admin only).
   */
  reviewOnboarding = asyncHandler(async (req, res) => {
    const { restaurantId } = req.params;
    const { action, rejectionReason } = req.body;
    
    // admin user context is populated by protect middleware
    const restaurant = await RestaurantService.reviewOnboarding(
      restaurantId,
      action,
      rejectionReason,
      req.user._id
    );

    const message = action === 'approve' 
      ? 'Restaurant onboarding approved successfully' 
      : 'Restaurant onboarding application rejected';
      
    return sendSuccess(res, 200, message, restaurant);
  });

  /**
   * Get restaurant details (Staff members only).
   */
  getRestaurantDetails = asyncHandler(async (req, res) => {
    // req.restaurantId is populated by resolveTenant middleware
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
   * Get all pending onboarding registrations (Platform Admins only).
   */
  getPendingOnboardings = asyncHandler(async (req, res) => {
    const list = await RestaurantService.getPendingOnboardings();
    return sendSuccess(res, 200, 'Pending onboarding applications retrieved successfully', list);
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

  /**
   * Get all registered restaurants (Platform Admins only).
   */
  getRestaurants = asyncHandler(async (req, res) => {
    const list = await RestaurantService.getRestaurants(req.query);
    return sendSuccess(res, 200, 'Restaurants retrieved successfully', list);
  });

  /**
   * Admin account deletion (Platform Admins / Developers only).
   */
  deleteRestaurantAdmin = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await RestaurantService.deleteRestaurantAdmin(id);
    return sendSuccess(res, 200, 'Restaurant account soft-deleted successfully.');
  });
}

module.exports = new RestaurantController();
