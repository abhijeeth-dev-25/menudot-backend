const CampaignRepository = require('../../repositories/restaurant/campaign.repository');
const Campaign = require('../../models/campaign.model');
const MenuItem = require('../../models/menuItem.model');
const AppError = require('../../exceptions/AppError');
const logger = require('../../utils/logger');

class CampaignService {
  /**
   * Configures a new advertising campaign.
   */
  async createCampaign(restaurantId, data) {
    const { type, menuItemId, startDate, endDate } = data;

    // 1. Validation for sponsored item
    if (type === 'sponsored_item') {
      if (!menuItemId) {
        throw new AppError(400, 'Menu Item ID is required for sponsored item campaigns.');
      }
      const itemExists = await MenuItem.findOne({ _id: menuItemId, restaurantId });
      if (!itemExists) {
        throw new AppError(400, 'The referenced Menu Item does not exist for this restaurant.');
      }
    }

    const campaignData = {
      ...data,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };

    const campaign = await CampaignRepository.create(restaurantId, campaignData);
    logger.info({ campaignId: campaign._id, restaurantId }, 'Advertising campaign created successfully');
    return campaign;
  }

  /**
   * Retrieves all campaigns for a restaurant.
   */
  async getCampaigns(restaurantId, query) {
    const filters = {};
    if (query.status) {
      filters.status = query.status;
    }
    if (query.type) {
      filters.type = query.type;
    }
    return CampaignRepository.findAll(restaurantId, filters);
  }

  /**
   * Updates an advertising campaign.
   */
  async updateCampaign(restaurantId, id, updateData) {
    const campaign = await CampaignRepository.findById(restaurantId, id);
    if (!campaign) {
      throw new AppError(404, 'Campaign not found.');
    }

    const updated = await CampaignRepository.update(restaurantId, id, updateData);
    logger.info({ campaignId: id, restaurantId }, 'Campaign parameters updated successfully');
    return updated;
  }

  /**
   * Retrieves currently running active ads and increments impression counts.
   */
  async getActiveSponsoredContent(restaurantId) {
    const today = new Date();

    // Query active campaigns that are running today and haven't exceeded their budget
    const activeCampaigns = await Campaign.find({
      restaurantId,
      status: 'active',
      startDate: { $lte: today },
      endDate: { $gte: today },
      $expr: { $lt: ['$currentSpent', '$budgetLimit'] },
    }).populate('menuItemId');

    // Atomically increment impressions for served ads
    for (const campaign of activeCampaigns) {
      await Campaign.updateOne(
        { _id: campaign._id },
        { $inc: { 'metrics.impressions': 1 } }
      );
    }

    logger.info({ restaurantId, servedCount: activeCampaigns.length }, 'Served active sponsored campaigns');
    return activeCampaigns;
  }

  /**
   * Tracks customer clicks on an ad campaign, charging cost-per-click to budget.
   */
  async trackCampaignClick(restaurantId, id) {
    const campaign = await CampaignRepository.findById(restaurantId, id);
    if (!campaign) {
      throw new AppError(404, 'Campaign not found.');
    }

    if (campaign.status !== 'active' || campaign.currentSpent >= campaign.budgetLimit) {
      throw new AppError(400, 'Campaign is either inactive or has exhausted its budget limit.');
    }

    const nextSpent = campaign.currentSpent + campaign.costPerClick;
    const updateData = {
      $inc: { 'metrics.clicks': 1, currentSpent: campaign.costPerClick },
    };

    // If budget limit is reached, auto-pauses / completes campaign
    if (nextSpent >= campaign.budgetLimit) {
      updateData.$set = { status: 'completed' };
      logger.info({ campaignId: id, restaurantId }, 'Campaign budget exhausted. Setting status to completed.');
    }

    const updatedCampaign = await Campaign.findOneAndUpdate(
      { _id: id, restaurantId },
      updateData,
      { new: true }
    );

    return updatedCampaign;
  }
}

module.exports = new CampaignService();
