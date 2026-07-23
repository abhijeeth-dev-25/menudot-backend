const PlatformFinanceService = require('../../services/platform/platformFinance.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

class PlatformFinanceController {
  /**
   * Get Platform Financial Overview (Gross Revenue, Commission, Onboarding Fees).
   * GET /api/v1/platform/finance/overview
   */
  getFinancialOverview = asyncHandler(async (req, res) => {
    const result = await PlatformFinanceService.getPlatformFinancialOverview();
    return sendSuccess(res, 200, 'Platform financial overview retrieved', result);
  });

  /**
   * Global Payment Transaction Ledger.
   * GET /api/v1/platform/finance/transactions
   */
  getTransactionLedger = asyncHandler(async (req, res) => {
    const result = await PlatformFinanceService.getPlatformTransactionLedger(req.query);
    return sendSuccess(res, 200, 'Platform transaction ledger retrieved', result);
  });

  /**
   * Disburse Merchant Bank Payout Settlement.
   * POST /api/v1/platform/finance/settlements/:restaurantId/disburse
   */
  disburseSettlement = asyncHandler(async (req, res) => {
    const { restaurantId } = req.params;
    const adminUserId = req.user._id;
    const result = await PlatformFinanceService.disburseMerchantSettlement(restaurantId, req.body, adminUserId);
    return sendSuccess(res, 200, 'Merchant settlement payout disbursed successfully', result);
  });

  /**
   * Update Restaurant SaaS Subscription Tier / Extension.
   * PATCH /api/v1/platform/finance/subscriptions/:restaurantId
   */
  updateSubscription = asyncHandler(async (req, res) => {
    const { restaurantId } = req.params;
    const adminUserId = req.user._id;
    const result = await PlatformFinanceService.updateRestaurantSubscription(restaurantId, req.body, adminUserId);
    return sendSuccess(res, 200, 'Restaurant subscription updated successfully', result);
  });
}

module.exports = new PlatformFinanceController();
