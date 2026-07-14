const Campaign = require('../models/campaign.model');

class CampaignRepository {
  async create(restaurantId, campaignData, options = {}) {
    const campaign = new Campaign({
      ...campaignData,
      restaurantId,
    });
    return campaign.save(options);
  }

  async findById(restaurantId, id, options = {}) {
    return Campaign.findOne({ _id: id, restaurantId }, null, options);
  }

  async findAll(restaurantId, filters = {}, options = {}) {
    const query = { restaurantId, ...filters };
    return Campaign.find(query, null, options).sort({ startDate: 1 });
  }

  async update(restaurantId, id, updateData, options = {}) {
    return Campaign.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: updateData },
      { new: true, runValidators: true, ...options }
    );
  }
}

module.exports = new CampaignRepository();
