const express = require('express');
const PaymentController = require('../../controllers/restaurant/payment.controller');
const validate = require('../../middlewares/validate');
const { protect } = require('../../middlewares/auth');
const config = require('../../config/env');
const AppError = require('../../exceptions/AppError');
const {
  createPaymentSchema,
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

// All payment routes require valid authentication
router.use(protect);

// Standard Payment Endpoints
router.post('/create', validate(createPaymentSchema), PaymentController.createPayment);
router.post('/verify', validate(verifyPaymentSchema), PaymentController.verifyPayment);
router.post('/refund', validate(refundPaymentSchema), PaymentController.refundPayment);
router.get('/history', PaymentController.getPaymentHistory);
router.get('/:id', PaymentController.getPaymentDetails);

// Development-Only Override Endpoint
router.post('/mock/result', requireDevEnvironment, validate(mockResultSchema), PaymentController.forceMockResult);

module.exports = router;
