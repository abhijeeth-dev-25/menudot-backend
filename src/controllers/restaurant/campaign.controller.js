const CampaignService = require('../../services/restaurant/campaign.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

class CampaignController {
  createCampaign = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const campaign = await CampaignService.createCampaign(restaurantId, req.body);
    return sendSuccess(res, 201, 'Ad campaign configured successfully.', campaign);
  });

  getCampaigns = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const campaigns = await CampaignService.getCampaigns(restaurantId, req.query);
    return sendSuccess(res, 200, 'Campaigns list retrieved successfully.', campaigns);
  });

  updateCampaign = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const { id } = req.params;
    const updated = await CampaignService.updateCampaign(restaurantId, id, req.body);
    return sendSuccess(res, 200, 'Campaign parameters updated successfully.', updated);
  });

  getActiveSponsoredContent = asyncHandler(async (req, res) => {
    // Accessible publicly by customer screen views, requires tenant context
    const restaurantId = req.restaurantId;
    const activeAds = await CampaignService.getActiveSponsoredContent(restaurantId);
    return sendSuccess(res, 200, 'Active sponsored content retrieved.', activeAds);
  });

  trackCampaignClick = asyncHandler(async (req, res) => {
    // Accessible publicly when customer clicks an ad
    const restaurantId = req.restaurantId;
    const { id } = req.params;
    const updated = await CampaignService.trackCampaignClick(restaurantId, id);
    return sendSuccess(res, 200, 'Campaign click registered.', updated);
  });
}

module.exports = new CampaignController();
