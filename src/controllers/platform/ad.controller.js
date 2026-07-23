const AdService = require('../../services/platform/ad.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../exceptions/AppError');

class AdController {
  /**
   * Admin/Advertiser: Create ad campaign
   */
  createCampaign = asyncHandler(async (req, res) => {
    const { campaign, creative, targeting } = req.body;

    if (!campaign || !creative || !targeting) {
      throw new AppError(400, 'Campaign details, creative assets, and targeting rules are all required.');
    }

    // Set advertiserId to current admin/user if not specified
    if (!campaign.advertiserId) {
      campaign.advertiserId = req.user._id;
    }

    const result = await AdService.createCampaign({ campaign, creative, targeting });
    return sendSuccess(res, 201, 'Ad campaign created successfully', result);
  });

  /**
   * Public: Serve matching ad based on placement context
   */
  serveAd = asyncHandler(async (req, res) => {
    const { placementKey, city, pincode, state, tags, restaurantId } = req.query;

    if (!placementKey) {
      throw new AppError(400, 'Parameter "placementKey" is required.');
    }

    // Parse tags array
    const parsedTags = tags ? tags.split(',') : [];

    const result = await AdService.serveAd(placementKey, {
      city,
      pincode,
      state,
      tags: parsedTags,
      restaurantId,
    });

    if (!result) {
      return sendSuccess(res, 200, 'No matching active ad found for this context', null);
    }

    return sendSuccess(res, 200, 'Matching ad creative retrieved successfully', result);
  });

  /**
   * Public: Click/Impression events
   */
  trackEvent = asyncHandler(async (req, res) => {
    const { token, eventType } = req.body;

    if (!token || !eventType) {
      throw new AppError(400, 'Both "token" and "eventType" parameters are required.');
    }

    const validTypes = ['click', 'impression'];
    if (!validTypes.includes(eventType)) {
      throw new AppError(400, `Invalid event type "${eventType}". Must be one of ${validTypes.join(', ')}.`);
    }

    const result = await AdService.trackEvent(token, eventType);
    return sendSuccess(res, 200, 'Ad event logged successfully', result);
  });

  /**
   * Admin: List all ad campaigns
   */
  listCampaigns = asyncHandler(async (req, res) => {
    const result = await AdService.listCampaigns(req.query);
    return sendSuccess(res, 200, 'Ad campaigns retrieved successfully', result);
  });

  /**
   * Admin: Update campaign status
   */
  updateCampaignStatus = asyncHandler(async (req, res) => {
    const { campaignId } = req.params;
    const { status } = req.body;
    const result = await AdService.updateCampaignStatus(campaignId, status);
    return sendSuccess(res, 200, `Ad campaign status updated to '${status}'`, result);
  });
}

module.exports = new AdController();
