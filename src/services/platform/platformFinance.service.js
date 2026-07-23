const Payment = require('../../models/payment.model');
const Restaurant = require('../../models/restaurant.model');
const PlatformAuditLog = require('../../models/platformAuditLog.model');
const AppError = require('../../exceptions/AppError');
const { PaymentStatus, PaymentCategory } = require('../../gateways/payment/types/payment.types');
const logger = require('../../utils/logger');

class PlatformFinanceService {
  /**
   * Retrieves high-level platform financial metrics & revenue overview.
   */
  async getPlatformFinancialOverview() {
    const successfulPayments = await Payment.find({ status: PaymentStatus.SUCCESS });

    let grossVolume = 0;
    let onboardingFeesCollected = 0;
    let subscriptionRevenue = 0;
    let adSpendRevenue = 0;
    let qrOrdersVolume = 0;

    successfulPayments.forEach((payment) => {
      grossVolume += payment.amount;
      switch (payment.paymentCategory) {
        case PaymentCategory.ONBOARDING_FEE:
          onboardingFeesCollected += payment.amount;
          break;
        case PaymentCategory.SUBSCRIPTION_FEE:
          subscriptionRevenue += payment.amount;
          break;
        case PaymentCategory.MERCHANT_AD_CAMPAIGN:
          adSpendRevenue += payment.amount;
          break;
        case PaymentCategory.TABLE_QR_ORDER:
        default:
          qrOrdersVolume += payment.amount;
          break;
      }
    });

    const platformCommissionPercent = 5; // 5% commission on QR orders
    const gatewayFeePercent = 2; // 2% gateway cost

    const platformCommissionEarned = Math.round((qrOrdersVolume * (platformCommissionPercent / 100)) * 100) / 100;
    const gatewayFeeExpense = Math.round((grossVolume * (gatewayFeePercent / 100)) * 100) / 100;
    const netPlatformRevenue = Math.round(
      (onboardingFeesCollected + subscriptionRevenue + adSpendRevenue + platformCommissionEarned - gatewayFeeExpense) * 100
    ) / 100;

    const totalOutlets = await Restaurant.countDocuments({ isDeleted: false });
    const activeOutlets = await Restaurant.countDocuments({ 'onboarding.stage': 'approved', isDeleted: false });

    return {
      overview: {
        grossVolume,
        onboardingFeesCollected,
        subscriptionRevenue,
        adSpendRevenue,
        qrOrdersVolume,
        platformCommissionEarned,
        gatewayFeeExpense,
        netPlatformRevenue,
      },
      outlets: {
        totalOutlets,
        activeOutlets,
      },
    };
  }

  /**
   * Global platform payment transaction ledger with filtering.
   */
  async getPlatformTransactionLedger(filters = {}) {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.paymentCategory) query.paymentCategory = filters.paymentCategory;
    if (filters.restaurantId) query.restaurantId = filters.restaurantId;

    return Payment.find(query).sort({ createdAt: -1 }).limit(100);
  }

  /**
   * Disburses bank payout to a merchant and logs settlement.
   */
  async disburseMerchantSettlement(restaurantId, { amount, date, bankReferenceId }, adminUserId) {
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant not found.');
    }

    const auditLog = await PlatformAuditLog.create({
      adminUserId,
      action: 'DISBURSE_MERCHANT_SETTLEMENT',
      targetEntity: { entityType: 'Restaurant', entityId: restaurantId },
      details: {
        amount,
        settlementDate: date || new Date().toISOString().split('T')[0],
        bankReferenceId: bankReferenceId || `REF-${Date.now()}`,
      },
    });

    logger.info({ restaurantId, amount, bankReferenceId }, 'Merchant bank payout disbursed by platform admin');

    return {
      restaurantId,
      restaurantName: restaurant.name,
      disbursedAmount: amount,
      bankReferenceId: auditLog.details.bankReferenceId,
      settlementDate: auditLog.details.settlementDate,
      status: 'DISBURSED',
    };
  }

  /**
   * Updates a restaurant's SaaS subscription tier or status.
   */
  async updateRestaurantSubscription(restaurantId, { planTier, status, extendDays }, adminUserId) {
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant not found.');
    }

    const updates = {};
    const chosenPlan = planTier || plan;
    if (chosenPlan) updates['subscription.plan'] = chosenPlan.toLowerCase();
    if (status) updates['subscription.status'] = status;
    if (extendDays) {
      const currentRenewal = restaurant.subscription?.renewsAt || new Date();
      updates['subscription.renewsAt'] = new Date(currentRenewal.getTime() + extendDays * 24 * 60 * 60 * 1000);
    }

    const updatedRestaurant = await Restaurant.findByIdAndUpdate(restaurantId, { $set: updates }, { new: true });

    await PlatformAuditLog.create({
      adminUserId,
      action: 'UPDATE_RESTAURANT_SUBSCRIPTION',
      targetEntity: { entityType: 'Restaurant', entityId: restaurantId },
      details: updates,
    });

    return updatedRestaurant.subscription;
  }
}

module.exports = new PlatformFinanceService();
