/**
 * Abstract Payment Gateway Interface
 * All payment provider implementations (Mock, Razorpay, Stripe, Cashfree, etc.)
 * MUST extend/implement this class contract.
 */
class PaymentGatewayInterface {
  /**
   * Creates a payment order with the provider.
   * @param {object} orderData - Payment order parameters (amount, currency, orderId, metadata)
   * @returns {Promise<object>} Standardized payment order object
   */
  async createOrder(orderData) {
    throw new Error('Method createOrder() must be implemented.');
  }

  /**
   * Verifies payment authenticity and completion status.
   * @param {object} verificationData - Payment verification data (paymentId, gatewayOrderId, signature)
   * @returns {Promise<object>} Standardized payment verification result object
   */
  async verifyPayment(verificationData) {
    throw new Error('Method verifyPayment() must be implemented.');
  }

  /**
   * Captures an authorized payment.
   * @param {string} paymentId - Provider payment ID
   * @param {number} amount - Amount to capture
   * @returns {Promise<object>} Standardized captured payment object
   */
  async capturePayment(paymentId, amount) {
    throw new Error('Method capturePayment() must be implemented.');
  }

  /**
   * Initiates a refund for a payment.
   * @param {object} refundData - Refund details (paymentId, amount, reason)
   * @returns {Promise<object>} Standardized refund result object
   */
  async refund(refundData) {
    throw new Error('Method refund() must be implemented.');
  }

  /**
   * Cancels a pending payment.
   * @param {string} paymentId - Provider payment ID
   * @param {string} [reason] - Cancellation reason
   * @returns {Promise<object>} Standardized cancelled payment object
   */
  async cancelPayment(paymentId, reason) {
    throw new Error('Method cancelPayment() must be implemented.');
  }
}

module.exports = PaymentGatewayInterface;
