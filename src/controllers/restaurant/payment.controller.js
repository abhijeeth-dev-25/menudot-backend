const PaymentService = require('../../services/restaurant/payment.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

class PaymentController {
  /**
   * Create a new payment order.
   * POST /api/v1/payments/create
   */
  createPayment = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const result = await PaymentService.createPayment(restaurantId, req.body);
    return sendSuccess(res, 201, 'Payment order created successfully', result);
  });

  /**
   * Verify payment signature / status.
   * POST /api/v1/payments/verify
   */
  verifyPayment = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const result = await PaymentService.verifyPayment(restaurantId, req.body);
    return sendSuccess(res, 200, 'Payment verification processed', result);
  });

  /**
   * Refund an existing payment.
   * POST /api/v1/payments/refund
   */
  refundPayment = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const result = await PaymentService.refundPayment(restaurantId, req.body);
    return sendSuccess(res, 200, 'Payment refund processed successfully', result);
  });

  /**
   * Retrieve payment details by ID or paymentId.
   * GET /api/v1/payments/:id
   */
  getPaymentDetails = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const { id } = req.params;
    const result = await PaymentService.getPaymentById(restaurantId, id);
    return sendSuccess(res, 200, 'Payment details retrieved', result);
  });

  /**
   * Retrieve payment history.
   * GET /api/v1/payments/history
   */
  getPaymentHistory = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const result = await PaymentService.getPaymentHistory(restaurantId, req.query);
    return sendSuccess(res, 200, 'Payment history retrieved', result);
  });

  /**
   * Development-Only: Force mock payment status update.
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
