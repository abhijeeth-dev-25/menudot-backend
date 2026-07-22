const config = require('../../../config/env');
const MockPaymentGateway = require('../mock/mockPayment.gateway');
const logger = require('../../../utils/logger');
const AppError = require('../../../exceptions/AppError');

class PaymentFactory {
  constructor() {
    this._gateways = new Map();
    // Pre-register Mock Payment Gateway
    const mockGateway = new MockPaymentGateway();
    this._gateways.set('mock', mockGateway);
  }

  /**
   * Registers a custom payment gateway implementation.
   * @param {string} mode - e.g. 'razorpay', 'stripe', 'cashfree'
   * @param {PaymentGatewayInterface} gatewayInstance
   */
  registerGateway(mode, gatewayInstance) {
    this._gateways.set(mode.toLowerCase(), gatewayInstance);
    logger.info({ mode }, `Registered custom Payment Gateway implementation for mode: ${mode}`);
  }

  /**
   * Selects and returns the active payment gateway instance based on environment mode.
   * @param {string} [mode] - Optional override mode
   * @returns {PaymentGatewayInterface}
   */
  getGateway(mode) {
    const selectedMode = (mode || config.payment?.mode || process.env.PAYMENT_MODE || 'mock').toLowerCase();

    if (this._gateways.has(selectedMode)) {
      return this._gateways.get(selectedMode);
    }

    // If requested mode is supported by design (e.g. Razorpay) but not yet instantiated with API keys
    if (['razorpay', 'cashfree', 'stripe', 'phonepe'].includes(selectedMode)) {
      logger.warn(
        { requestedMode: selectedMode },
        `Payment mode '${selectedMode}' is configured but module is not loaded yet. Falling back to Mock Payment Gateway.`
      );
      return this._gateways.get('mock');
    }

    throw new AppError(400, `Unsupported payment gateway mode: '${selectedMode}'`);
  }
}

module.exports = new PaymentFactory();
