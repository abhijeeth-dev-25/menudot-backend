const paymentFactory = require('../../gateways/payment/factory/payment.factory');
const PaymentRepository = require('../../repositories/restaurant/payment.repository');
const { PaymentStatus, RefundStatus } = require('../../gateways/payment/types/payment.types');
const AppError = require('../../exceptions/AppError');
const logger = require('../../utils/logger');

class PaymentService {
  /**
   * Internal helper to retrieve the active PaymentGatewayInterface implementation.
   * Service NEVER references concrete classes (MockPaymentGateway / RazorpayGateway) directly.
   */
  _getGateway() {
    return paymentFactory.getGateway();
  }

  /**
   * Creates a payment order with the active gateway provider.
   * @param {string} restaurantId - Owning tenant ID
   * @param {object} paymentInput - Payment attributes (amount, currency, orderId, paymentMethod, metadata)
   */
  async createPayment(restaurantId, paymentInput) {
    const { amount, currency = 'INR', orderId, paymentMethod, metadata } = paymentInput;

    if (!amount || amount <= 0) {
      throw new AppError(400, 'Payment amount must be greater than 0.');
    }

    const gateway = this._getGateway();

    // 1. Create order with gateway interface
    const gatewayResponse = await gateway.createOrder({
      amount,
      currency,
      orderId,
      paymentMethod,
      metadata,
    });

    // 2. Persist payment record in database
    const paymentRecord = await PaymentRepository.create(restaurantId, {
      orderId: gatewayResponse.orderId,
      paymentId: gatewayResponse.paymentId,
      gatewayOrderId: gatewayResponse.gatewayOrderId,
      gateway: gatewayResponse.gateway,
      amount: gatewayResponse.amount,
      currency: gatewayResponse.currency,
      status: gatewayResponse.status,
      paymentMethod: gatewayResponse.paymentMethod,
      transactionId: gatewayResponse.transactionId,
      metadata: gatewayResponse.metadata,
    });

    logger.info(
      { restaurantId, paymentId: paymentRecord.paymentId, amount: paymentRecord.amount, gateway: gatewayResponse.gateway },
      'Payment Service: Created payment order'
    );

    return paymentRecord;
  }

  /**
   * Verifies a payment's authenticity and status.
   * @param {string} [restaurantId] - Owning tenant ID
   * @param {object} verificationInput - Verification payload (paymentId, gatewayOrderId, signature, forceStatus)
   */
  async verifyPayment(restaurantId, verificationInput) {
    const { paymentId, gatewayOrderId, forceStatus } = verificationInput;

    if (!paymentId && !gatewayOrderId) {
      throw new AppError(400, 'Must provide paymentId or gatewayOrderId for verification.');
    }

    // 1. Locate payment record
    const targetId = paymentId || gatewayOrderId;
    const existingPayment = await PaymentRepository.findByIdOrPaymentId(restaurantId, targetId);

    if (!existingPayment) {
      throw new AppError(404, `Payment record not found for ID '${targetId}'.`);
    }

    const gateway = this._getGateway();

    // 2. Delegate verification to active gateway contract
    const verificationResult = await gateway.verifyPayment({
      paymentId: existingPayment.paymentId,
      gatewayOrderId: existingPayment.gatewayOrderId,
      forceStatus,
    });

    // 3. Update database record with status & transaction ID
    const updatedPayment = await PaymentRepository.update(restaurantId, existingPayment.paymentId, {
      status: verificationResult.status,
      transactionId: verificationResult.transactionId || existingPayment.transactionId,
    });

    logger.info(
      { restaurantId, paymentId: updatedPayment.paymentId, status: updatedPayment.status },
      'Payment Service: Verified payment status'
    );

    return updatedPayment;
  }

  /**
   * Initiates a refund for an existing payment.
   * @param {string} restaurantId - Owning tenant ID
   * @param {object} refundInput - Refund parameters (paymentId, amount, reason)
   */
  async refundPayment(restaurantId, refundInput) {
    const { paymentId, amount, reason } = refundInput;

    if (!paymentId) {
      throw new AppError(400, 'paymentId is required to process refund.');
    }

    const existingPayment = await PaymentRepository.findByPaymentId(restaurantId, paymentId);
    if (!existingPayment) {
      throw new AppError(404, `Payment '${paymentId}' not found.`);
    }

    if (existingPayment.status !== PaymentStatus.SUCCESS) {
      throw new AppError(400, `Cannot refund payment in status '${existingPayment.status}'. Only SUCCESS payments can be refunded.`);
    }

    const refundAmount = amount || existingPayment.amount;
    if (refundAmount > existingPayment.amount) {
      throw new AppError(400, `Refund amount (${refundAmount}) exceeds original payment amount (${existingPayment.amount}).`);
    }

    const gateway = this._getGateway();

    // 1. Call gateway refund contract
    const refundResult = await gateway.refund({
      paymentId: existingPayment.paymentId,
      amount: refundAmount,
      reason,
    });

    // 2. Update payment database record with refund details
    const updatedPayment = await PaymentRepository.update(restaurantId, existingPayment.paymentId, {
      refundDetails: {
        refundId: refundResult.refundId,
        amount: refundResult.amount,
        status: refundResult.status,
        reason: refundResult.reason,
        createdAt: refundResult.createdAt,
      },
    });

    logger.info(
      { restaurantId, paymentId: existingPayment.paymentId, refundId: refundResult.refundId, amount: refundAmount },
      'Payment Service: Refunded payment'
    );

    return updatedPayment;
  }

  /**
   * Retrieves payment details by ID or paymentId.
   * @param {string} restaurantId - Owning tenant ID
   * @param {string} id - Mongo ID or paymentId
   */
  async getPaymentById(restaurantId, id) {
    const payment = await PaymentRepository.findByIdOrPaymentId(restaurantId, id);
    if (!payment) {
      throw new AppError(404, `Payment '${id}' not found.`);
    }
    return payment;
  }

  /**
   * Retrieves payment history for a tenant.
   * @param {string} restaurantId - Owning tenant ID
   * @param {object} [filters={}] - Optional query filters (status, orderId, gateway)
   */
  async getPaymentHistory(restaurantId, filters = {}) {
    return PaymentRepository.findAll(restaurantId, filters);
  }

  /**
   * Development-Only Helper to force mock payment status updates.
   * @param {string} restaurantId - Owning tenant ID
   * @param {string} paymentId - Payment ID
   * @param {string} status - Desired mock status (SUCCESS, FAILED, PENDING, CANCELLED, TIMEOUT)
   */
  async forceMockResult(restaurantId, paymentId, status) {
    if (!Object.values(PaymentStatus).includes(status)) {
      throw new AppError(400, `Invalid status '${status}'. Supported statuses: ${Object.values(PaymentStatus).join(', ')}`);
    }

    return this.verifyPayment(restaurantId, { paymentId, forceStatus: status });
  }
}

module.exports = new PaymentService();
