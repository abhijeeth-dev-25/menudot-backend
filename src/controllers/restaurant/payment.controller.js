const PaymentService = require('../../services/restaurant/payment.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

class PaymentController {
  /**
   * 1. Create Onboarding Security Fee Payment (₹1,950).
   * POST /api/v1/payments/onboarding/initiate
   */
  createOnboardingPayment = asyncHandler(async (req, res) => {
    const restaurantId = req.body.restaurantId || req.user?.restaurantId || req.headers['x-restaurant-id'];
    const result = await PaymentService.createOnboardingPayment(restaurantId, req.body);
    return sendSuccess(res, 201, 'Onboarding security fee payment initiated (₹1,950)', result);
  });

  /**
   * 1b. Verify Onboarding Security Fee Payment & Generate Invoice.
   * POST /api/v1/payments/onboarding/verify
   */
  verifyOnboardingPayment = asyncHandler(async (req, res) => {
    const restaurantId = req.body.restaurantId || req.user?.restaurantId || req.headers['x-restaurant-id'];
    const result = await PaymentService.verifyOnboardingPayment(restaurantId, req.body);
    return sendSuccess(res, 200, 'Onboarding security deposit verified & stage updated to pending_approval', result);
  });

  /**
   * 2. Create Table QR Order Payment.
   * POST /api/v1/payments/qr-order/initiate
   */
  createQROrderPayment = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const result = await PaymentService.createQROrderPayment(restaurantId, req.body);
    return sendSuccess(res, 201, 'Table QR order payment initiated', result);
  });

  /**
   * 3. Create Merchant Ad Campaign Payment.
   * POST /api/v1/payments/campaigns/initiate
   */
  createCampaignPayment = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const result = await PaymentService.createCampaignPayment(restaurantId, req.body);
    return sendSuccess(res, 201, 'Merchant ad campaign payment initiated', result);
  });

  /**
   * 4. Create SaaS Software Subscription Payment.
   * POST /api/v1/payments/subscriptions/initiate
   */
  createSubscriptionPayment = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const result = await PaymentService.createSubscriptionPayment(restaurantId, req.body);
    return sendSuccess(res, 201, 'SaaS subscription payment initiated', result);
  });

  /**
   * 5. Get Daily Merchant Settlement Calculation.
   * GET /api/v1/payments/settlement/daily
   */
  getDailySettlement = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const { date } = req.query;
    const result = await PaymentService.calculateDailyMerchantSettlement(restaurantId, date);
    return sendSuccess(res, 200, 'Daily merchant settlement calculated', result);
  });

  /**
   * Generic Create Payment.
   * POST /api/v1/payments/create
   */
  createPayment = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const result = await PaymentService.createPayment(restaurantId, req.body);
    return sendSuccess(res, 201, 'Payment order created successfully', result);
  });

  /**
   * Generic Verify Payment.
   * POST /api/v1/payments/verify
   */
  verifyPayment = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const result = await PaymentService.verifyPayment(restaurantId, req.body);
    return sendSuccess(res, 200, 'Payment verification processed', result);
  });

  /**
   * Generic Refund Payment.
   * POST /api/v1/payments/refund
   */
  refundPayment = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const result = await PaymentService.refundPayment(restaurantId, req.body);
    return sendSuccess(res, 200, 'Payment refund processed successfully', result);
  });

  /**
   * Retrieve Payment Details by ID.
   * GET /api/v1/payments/:id
   */
  getPaymentDetails = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const { id } = req.params;
    const result = await PaymentService.getPaymentById(restaurantId, id);
    return sendSuccess(res, 200, 'Payment details retrieved', result);
  });

  /**
   * Retrieve Payment History.
   * GET /api/v1/payments/history
   */
  getPaymentHistory = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const result = await PaymentService.getPaymentHistory(restaurantId, req.query);
    return sendSuccess(res, 200, 'Payment history retrieved', result);
  });

  /**
   * Dev-only Force Mock Result.
   * POST /api/v1/payments/mock/result
   */
  forceMockResult = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const { paymentId, status } = req.body;
    const result = await PaymentService.forceMockResult(restaurantId, paymentId, status);
    return sendSuccess(res, 200, `Mock payment status updated to '${status}'`, result);
  });
}

module.exports = new PaymentController();
