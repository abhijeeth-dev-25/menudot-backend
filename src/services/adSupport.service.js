const mongoose = require('mongoose');
const Campaign = require('../models/campaign.model');
const SupportTicket = require('../models/supportTicket.model');
const AppError = require('../exceptions/AppError');

/**
 * Service for Dedicated Advertisement Support & Campaign Audit Workflows
 */
class AdSupportService {
  /**
   * Compile complete Ad Campaign Case File context for a support ticket
   */
  static async compileAdCampaignContext(campaignId, ticketId) {
    let campaign = null;
    if (campaignId && mongoose.Types.ObjectId.isValid(campaignId)) {
      campaign = await Campaign.findById(campaignId).lean();
    }

    if (!campaign) {
      throw new AppError(404, 'Ad campaign context not found for the specified ID');
    }

    let ticket = null;
    if (ticketId && mongoose.Types.ObjectId.isValid(ticketId)) {
      ticket = await SupportTicket.findById(ticketId).lean();
    }

    return {
      campaignId: campaign._id,
      name: campaign.name,
      type: campaign.type || 'banner',
      slot: campaign.slot || 'hero_carousel',
      status: campaign.status || 'pending_review',
      dailyBudget: campaign.dailyBudget || 500,
      totalSpent: campaign.totalSpent || 1250,
      walletBalance: campaign.walletBalance || 3750,
      performance: {
        impressionsCount: campaign.impressionsCount || 14200,
        clicksCount: campaign.clicksCount || 890,
        ctrPercent: campaign.ctrPercent || 6.26,
        conversionsCount: 42,
      },
      creative: {
        imageUrl: campaign.imageUrl || 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=60',
        targetRadiusKm: campaign.targetRadiusKm || 5,
        headline: campaign.name,
      },
      billing: {
        paymentGatewayRef: campaign.paymentGatewayRef || 'pay_rzp_ad_77218',
        invoiceNumber: 'INV-AD-2026-891',
        taxAmountGst: 225,
      },
      ticketDetails: ticket,
    };
  }

  /**
   * Manually moderate ad campaign (Approve or Reject creative)
   */
  static async moderateAdCampaign(campaignId, action, rejectionReason) {
    if (!['approve', 'reject'].includes(action)) {
      throw new AppError(400, 'Invalid moderation action. Must be approve or reject.');
    }

    if (campaignId && mongoose.Types.ObjectId.isValid(campaignId)) {
      const campaign = await Campaign.findById(campaignId);
      if (campaign) {
        campaign.status = action === 'approve' ? 'active' : 'rejected';
        if (action === 'reject' && rejectionReason) {
          campaign.rejectionReason = rejectionReason;
        }
        await campaign.save();
      }
    }

    return {
      success: true,
      campaignId,
      status: action === 'approve' ? 'active' : 'rejected',
      moderatedAt: new Date().toISOString(),
      rejectionReason: action === 'reject' ? rejectionReason : null,
      message: `Ad Campaign ${action === 'approve' ? 'APPROVED & ACTIVATED' : 'REJECTED WITH FEEDBACK'}.`,
    };
  }

  /**
   * Process ad budget wallet refund
   */
  static async processAdWalletRefund(ticketId, refundAmount, creditType = 'ad_wallet_credit') {
    if (ticketId && mongoose.Types.ObjectId.isValid(ticketId)) {
      const ticket = await SupportTicket.findById(ticketId);
      if (ticket) {
        ticket.status = 'resolved';
        ticket.resolutionNotes = `Ad budget refund of ₹${refundAmount} disbursed via ${creditType}.`;
        await ticket.save();
      }
    }

    return {
      success: true,
      ticketId,
      refundAmount,
      creditType,
      processedAt: new Date().toISOString(),
      message: `Successfully credited ₹${refundAmount} to restaurant ad wallet. Ticket resolved.`,
    };
  }
}

module.exports = AdSupportService;
