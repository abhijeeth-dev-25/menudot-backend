const AdCreative = require('../../models/adCreative.model');
const AdTargetingRule = require('../../models/adTargetingRule.model');

class AdPlacementService {
  /**
   * Serves targeted ad creatives for customer UI placement zones
   */
  static async getAdsForPlacement(placementKey, restaurantId = null) {
    if (!placementKey) {
      return [];
    }

    const filter = { placementKey };
    const creatives = await AdCreative.find(filter).lean();

    if (!creatives || creatives.length === 0) {
      // Fallback default system ad if no database ads configured
      return [
        {
          id: 'default_ad_1',
          placementKey,
          format: 'image',
          assets: {
            mediaUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=60',
            headingText: 'Delicious Weekend Delights',
            bodyText: 'Get 20% cashback on your first online payment with MenuDot Pay!',
            ctaText: 'View Special Offer',
          },
          destinationUrl: '#',
        },
      ];
    }

    return creatives.map((c) => ({
      id: c._id,
      placementKey: c.placementKey,
      format: c.format,
      assets: c.assets,
      destinationUrl: c.destinationUrl,
    }));
  }
}

module.exports = AdPlacementService;
