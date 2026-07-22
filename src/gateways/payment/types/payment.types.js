/**
 * Payment Gateway Constants & Types
 */

const PaymentStatus = Object.freeze({
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  TIMEOUT: 'TIMEOUT',
});

const RefundStatus = Object.freeze({
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
});

const PaymentMethod = Object.freeze({
  UPI: 'upi',
  CARD: 'card',
  NETBANKING: 'netbanking',
  WALLET: 'wallet',
  MOCK: 'mock_payment',
});

const PaymentMode = Object.freeze({
  MOCK: 'mock',
  RAZORPAY: 'razorpay',
  CASHFREE: 'cashfree',
  STRIPE: 'stripe',
  PHONEPE: 'phonepe',
});

module.exports = {
  PaymentStatus,
  RefundStatus,
  PaymentMethod,
  PaymentMode,
};
