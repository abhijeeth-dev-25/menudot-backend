const AdPlacementService = require('../../services/platform/adPlacement.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

class CustomerAdController {
  getAdsForPlacement = asyncHandler(async (req, res) => {
    const { placementKey } = req.query;
    const restaurantId = req.headers['x-restaurant-id'] || req.query.restaurantId || null;

    const ads = await AdPlacementService.getAdsForPlacement(placementKey, restaurantId);
    return sendSuccess(res, 200, 'Placement ads retrieved successfully', ads);
  });
}

module.exports = new CustomerAdController();
