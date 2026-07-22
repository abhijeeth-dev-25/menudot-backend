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

const PaymentCategory = Object.freeze({
  ONBOARDING_FEE: 'onboarding_security_fee',
  TABLE_QR_ORDER: 'table_qr_order',
  WEB_SLOT_BOOKING: 'web_slot_booking',
  MERCHANT_AD_CAMPAIGN: 'merchant_ad_campaign',
  SUBSCRIPTION_FEE: 'subscription_fee',
  MERCHANT_PAYOUT_SETTLEMENT: 'merchant_payout_settlement',
});

module.exports = {
  PaymentStatus,
  RefundStatus,
  PaymentMethod,
  PaymentMode,
  PaymentCategory,
};
