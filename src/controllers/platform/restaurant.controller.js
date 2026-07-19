const RestaurantService = require('../../services/platform/restaurant.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

class RestaurantPlatformController {
  /**
   * Review restaurant application (Platform admin only).
   */
  reviewOnboarding = asyncHandler(async (req, res) => {
    const { restaurantId } = req.params;
    const { action, rejectionReason } = req.body;
    
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
   * Get all pending onboarding registrations (Platform Admins only).
   */
  getPendingOnboardings = asyncHandler(async (req, res) => {
    const list = await RestaurantService.getPendingOnboardings();
    return sendSuccess(res, 200, 'Pending onboarding applications retrieved successfully', list);
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

module.exports = new RestaurantPlatformController();
