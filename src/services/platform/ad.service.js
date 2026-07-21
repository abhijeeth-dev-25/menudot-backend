const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const PlatformCampaign = require('../../models/platformCampaign.model');
const AdCreative = require('../../models/adCreative.model');
const AdTargetingRule = require('../../models/adTargetingRule.model');
const config = require('../../config/env');
const AppError = require('../../exceptions/AppError');
const logger = require('../../utils/logger');
const { runTransaction } = require('../../utils/transaction');

class AdService {
  /**
   * Admin: Provision a new advertisement campaign along with creative assets and targeting parameters.
   */
  async createCampaign({ campaign, creative, targeting }) {
    return runTransaction(async (session) => {
      // 1. Save campaign
      const newCampaign = new PlatformCampaign(campaign);
      await newCampaign.save({ session });

      // 2. Save creative
      const newCreative = new AdCreative({
        ...creative,
        campaignId: newCampaign._id,
      });
      await newCreative.save({ session });

      // 3. Save targeting rules
      const newTargeting = new AdTargetingRule({
        ...targeting,
        campaignId: newCampaign._id,
      });
      await newTargeting.save({ session });

      return {
        campaign: newCampaign,
        creative: newCreative,
        targeting: newTargeting,
      };
    });
  }

  /**
   * Public/B2B: Serve matching display ads based on placement context.
   * 
   * @param {string} placementKey - e.g., 'qr_menu_banner'
   * @param {object} context - { city, pincode, state, tags, restaurantId }
   */
  async serveAd(placementKey, context = {}) {
    const { city, pincode, state, tags = [], restaurantId } = context;

    // Find all active campaigns
    const now = new Date();
    const activeCampaigns = await PlatformCampaign.find({
      status: 'active',
      'schedule.startDate': { $lte: now },
      'schedule.endDate': { $gte: now },
    });

    if (!activeCampaigns.length) return null;

    const campaignIds = activeCampaigns.map((c) => c._id);

    // Fetch targeting rules for active campaigns
    const targetingRules = await AdTargetingRule.find({
      campaignId: { $in: campaignIds },
    });

    // Filter matching campaigns
    const matchedCampaignIds = [];
    for (const rule of targetingRules) {
      // 1. Geo Scope check
      const geo = rule.geoScope;
      if (geo) {
        if (geo.cities?.length && city && !geo.cities.includes(city)) continue;
        if (geo.pincodes?.length && pincode && !geo.pincodes.includes(pincode)) continue;
        if (geo.states?.length && state && !geo.states.includes(state)) continue;
      }

      // 2. Target Tags check
      if (rule.targetTags?.length && tags.length) {
        const matchesTag = rule.targetTags.some((t) => tags.includes(t));
        if (!matchesTag) continue;
      }

      // 3. Restaurant Scope blocklist/allowlist
      const restScope = rule.restaurantScope;
      if (restScope && restaurantId) {
        if (restScope.allowList?.length && !restScope.allowList.includes(restaurantId)) continue;
        if (restScope.blockList?.length && restScope.blockList.includes(restaurantId)) continue;
      }

      matchedCampaignIds.push(rule.campaignId.toString());
    }

    if (!matchedCampaignIds.length) return null;

    // Fetch corresponding creatives that match the requested placementKey
    const creatives = await AdCreative.find({
      campaignId: { $in: matchedCampaignIds },
      placementKey,
    });

    if (!creatives.length) return null;

    // Filter campaigns to those with remaining budget
    const finalCandidates = [];
    for (const creative of creatives) {
      const campaign = activeCampaigns.find((c) => c._id.toString() === creative.campaignId.toString());
      if (!campaign) continue;

      // Ensure budget not exhausted
      const isBudgetExhausted =
        campaign.pricing.spentTotal >= campaign.pricing.totalBudget ||
        campaign.pricing.spentDaily >= campaign.pricing.dailyBudget;

      if (!isBudgetExhausted) {
        finalCandidates.push({ campaign, creative });
      }
    }

    if (!finalCandidates.length) return null;

    // Pick campaign (priority / highest bid first, or random selection proportional to costPerUnit)
    // To be simple and robust: sort by costPerUnit descending (highest bidder wins)
    finalCandidates.sort((a, b) => b.campaign.pricing.costPerUnit - a.campaign.pricing.costPerUnit);
    const winner = finalCandidates[0];

    // Generate short-lived event tracking token
    const trackingToken = jwt.sign(
      {
        campaignId: winner.campaign._id.toString(),
        pricingModel: winner.campaign.pricing.model,
        costPerUnit: winner.campaign.pricing.costPerUnit,
      },
      config.jwt.accessSecret,
      { expiresIn: '1h' }
    );

    return {
      creative: winner.creative,
      trackingToken,
    };
  }

  /**
   * Track ad events (clicks and impressions) and deduct/update billing accounts.
   */
  async trackEvent(token, eventType) {
    let payload;
    try {
      payload = jwt.verify(token, config.jwt.accessSecret);
    } catch (err) {
      throw new AppError(400, 'Invalid or expired ad tracking token.');
    }

    const { campaignId, pricingModel, costPerUnit } = payload;
    const campaign = await PlatformCampaign.findById(campaignId);
    if (!campaign) {
      throw new AppError(404, 'Associated advertisement campaign not found.');
    }

    // Check if event type charges money (click for CPC, impression for CPM)
    const shouldCharge =
      (eventType === 'click' && pricingModel === 'CPC') ||
      (eventType === 'impression' && pricingModel === 'CPM');

    if (shouldCharge) {
      // Increment spent
      campaign.pricing.spentTotal += costPerUnit;
      campaign.pricing.spentDaily += costPerUnit;

      // Auto-suspend campaign if budget is hit
      if (campaign.pricing.spentTotal >= campaign.pricing.totalBudget) {
        campaign.status = 'completed';
        logger.info({ campaignId }, 'Campaign fully completed. Budget limit hit.');
      } else if (campaign.pricing.spentDaily >= campaign.pricing.dailyBudget) {
        campaign.status = 'paused';
        logger.info({ campaignId }, 'Campaign paused. Daily budget cap reached.');
      }

      await campaign.save();
    }

    return {
      success: true,
      campaignId,
      eventType,
      currentSpent: campaign.pricing.spentTotal,
      status: campaign.status,
    };
  }
}

module.exports = new AdService();
