const crypto = require('crypto');
const PaymentGatewayInterface = require('../interfaces/paymentGateway.interface');
const { PaymentStatus, RefundStatus, PaymentMethod } = require('../types/payment.types');
const logger = require('../../../utils/logger');

/**
 * Production-Ready Mock Payment Gateway Implementation.
 * Runs 100% offline without invoking any external payment APIs.
 */
class MockPaymentGateway extends PaymentGatewayInterface {
  constructor() {
    super();
    this.name = 'mock';
  }

  /**
   * Generates a realistic mock ID with standard provider prefix.
   * @param {string} prefix - e.g. 'pay_mock', 'order_mock', 'txn_mock', 'rfnd_mock'
   * @returns {string}
   */
  _generateId(prefix = 'pay_mock') {
    const randomHex = crypto.randomBytes(10).toString('hex');
    return `${prefix}_${randomHex}`;
  }

  /**
   * Creates a mock payment order.
   * @param {object} orderData - Payment order payload
   * @returns {Promise<object>}
   */
  async createOrder(orderData) {
    const { amount, currency = 'INR', orderId, paymentMethod = PaymentMethod.MOCK, metadata = {} } = orderData;

    const gatewayOrderId = this._generateId('order_mock');
    const paymentId = this._generateId('pay_mock');
    const transactionId = this._generateId('txn_mock');
    const createdAt = new Date().toISOString();

    const response = {
      gateway: this.name,
      paymentId,
      gatewayOrderId,
      orderId: orderId || this._generateId('ord'),
      amount: Number(amount),
      currency,
      paymentMethod,
      transactionId,
      status: PaymentStatus.PENDING,
      createdAt,
      metadata,
    };

    logger.info(
      { paymentId, gatewayOrderId, orderId: response.orderId, amount, status: response.status },
      'Payment Created (Mock Gateway)'
    );

    return response;
  }

  /**
   * Verifies mock payment status.
   * @param {object} verificationData
   * @returns {Promise<object>}
   */
  async verifyPayment(verificationData) {
    const { paymentId, gatewayOrderId, forceStatus } = verificationData;

    const status = forceStatus && Object.values(PaymentStatus).includes(forceStatus)
      ? forceStatus
      : PaymentStatus.SUCCESS;

    const verifiedAt = new Date().toISOString();
    const transactionId = this._generateId('txn_mock');

    const result = {
      gateway: this.name,
      paymentId: paymentId || this._generateId('pay_mock'),
      gatewayOrderId: gatewayOrderId || this._generateId('order_mock'),
      transactionId,
      status,
      verified: status === PaymentStatus.SUCCESS,
      verifiedAt,
    };

    if (status === PaymentStatus.SUCCESS) {
      logger.info({ paymentId: result.paymentId, status }, 'Payment Completed (Mock Gateway)');
    } else {
      logger.warn({ paymentId: result.paymentId, status }, 'Payment Failed (Mock Gateway)');
    }

    return result;
  }

  /**
   * Captures an authorized payment.
   * @param {string} paymentId
   * @param {number} amount
   * @returns {Promise<object>}
   */
  async capturePayment(paymentId, amount) {
    const capturedAt = new Date().toISOString();

    const response = {
      gateway: this.name,
      paymentId,
      amount: Number(amount),
      status: PaymentStatus.SUCCESS,
      captured: true,
      capturedAt,
    };

    logger.info({ paymentId, amount }, 'Payment Captured (Mock Gateway)');
    return response;
  }

  /**
   * Initiates a mock refund.
   * @param {object} refundData
   * @returns {Promise<object>}
   */
  async refund(refundData) {
    const { paymentId, amount, reason = 'Customer requested refund' } = refundData;
    const refundId = this._generateId('rfnd_mock');
    const createdAt = new Date().toISOString();

    const response = {
      gateway: this.name,
      refundId,
      paymentId,
      amount: Number(amount),
      status: RefundStatus.SUCCESS,
      reason,
      createdAt,
    };

    logger.info({ refundId, paymentId, amount, reason }, 'Payment Refunded (Mock Gateway)');
    return response;
  }

  /**
   * Cancels a pending mock payment.
   * @param {string} paymentId
   * @param {string} [reason='User cancelled session']
   * @returns {Promise<object>}
   */
  async cancelPayment(paymentId, reason = 'User cancelled session') {
    const cancelledAt = new Date().toISOString();

    const response = {
      gateway: this.name,
      paymentId,
      status: PaymentStatus.CANCELLED,
      reason,
      cancelledAt,
    };

    logger.info({ paymentId, reason }, 'Payment Cancelled (Mock Gateway)');
    return response;
  }
}

module.exports = MockPaymentGateway;
