const express = require('express');
const PaymentController = require('../../controllers/restaurant/payment.controller');
const validate = require('../../middlewares/validate');
const { protect } = require('../../middlewares/auth');
const config = require('../../config/env');
const AppError = require('../../exceptions/AppError');
const {
  createPaymentSchema,
  onboardingPaymentSchema,
  verifyOnboardingPaymentSchema,
  qrOrderPaymentSchema,
  campaignPaymentSchema,
  subscriptionPaymentSchema,
  verifyPaymentSchema,
  refundPaymentSchema,
  mockResultSchema,
} = require('../../validators/payment.validator');

const router = express.Router();

/**
 * Middleware: Blocks development-only endpoints when running in production environment.
 */
const requireDevEnvironment = (req, res, next) => {
  if (config.env === 'production') {
    return next(new AppError(403, 'Mock payment result override endpoints are disabled in production mode.'));
  }
  next();
};

// ==========================================
// PUBLIC MONETIZATION & ONBOARDING ENDPOINTS (No Auth Required)
// ==========================================
// 1. Initiate ₹1,950 Onboarding Security Fee Payment
router.post('/onboarding/initiate', validate(onboardingPaymentSchema), PaymentController.createOnboardingPayment);

// 2. Verify Onboarding Security Fee Payment & Update Stage to 'pending_approval'
router.post('/onboarding/verify', validate(verifyOnboardingPaymentSchema), PaymentController.verifyOnboardingPayment);

// ==========================================
// PROTECTED PAYMENT ENDPOINTS (Requires Auth)
// ==========================================
router.use(protect);

// 3. Initiate Table QR Order Payment
router.post('/qr-order/initiate', validate(qrOrderPaymentSchema), PaymentController.createQROrderPayment);

// 4. Initiate Merchant Ad Campaign Spend Payment
router.post('/campaigns/initiate', validate(campaignPaymentSchema), PaymentController.createCampaignPayment);

// 5. Initiate SaaS Subscription Fee Payment
router.post('/subscriptions/initiate', validate(subscriptionPaymentSchema), PaymentController.createSubscriptionPayment);

// 6. View Daily Merchant Settlement & Payout Report
router.get('/settlement/daily', PaymentController.getDailySettlement);

// 7. Standard Payment Operations
router.post('/create', validate(createPaymentSchema), PaymentController.createPayment);
router.post('/verify', validate(verifyPaymentSchema), PaymentController.verifyPayment);
router.post('/refund', validate(refundPaymentSchema), PaymentController.refundPayment);
router.get('/history', PaymentController.getPaymentHistory);
router.get('/:id', PaymentController.getPaymentDetails);

// 8. Development-Only Override Endpoint
router.post('/mock/result', requireDevEnvironment, validate(mockResultSchema), PaymentController.forceMockResult);

module.exports = router;
