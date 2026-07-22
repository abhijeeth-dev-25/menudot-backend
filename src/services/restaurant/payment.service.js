const paymentFactory = require('../../gateways/payment/factory/payment.factory');
const PaymentRepository = require('../../repositories/restaurant/payment.repository');
const Restaurant = require('../../models/restaurant.model');
const OrderRepository = require('../../repositories/restaurant/order.repository');
const CouponService = require('../platform/coupon.service');
const InvoiceService = require('../platform/invoice.service');
const { PaymentStatus, RefundStatus, PaymentCategory } = require('../../gateways/payment/types/payment.types');
const AppError = require('../../exceptions/AppError');
const logger = require('../../utils/logger');

class PaymentService {
  _getGateway() {
    return paymentFactory.getGateway();
  }

  /**
   * Generic low-level payment creation method across gateway abstraction.
   */
  async createPayment(restaurantId, paymentInput) {
    const {
      amount,
      currency = 'INR',
      orderId,
      paymentMethod,
      metadata = {},
      paymentCategory = PaymentCategory.TABLE_QR_ORDER,
      targetEntity = {},
      couponCode,
    } = paymentInput;

    if (!amount || amount < 0) {
      throw new AppError(400, 'Payment amount must be greater than or equal to 0.');
    }

    let finalPayableAmount = amount;
    let couponDiscountDetails = { code: null, discountAmount: 0, originalAmount: amount };

    // Process coupon validation if provided
    if (couponCode) {
      const couponResult = await CouponService.validateAndCalculateDiscount({
        couponCode,
        orderAmount: amount,
        restaurantId,
      });

      const discount = couponResult.discountAmount || 0;
      finalPayableAmount = Math.max(0, amount - discount);
      couponDiscountDetails = {
        code: couponCode.toUpperCase(),
        discountAmount: discount,
        originalAmount: amount,
      };
    }

    const gstBreakdown = InvoiceService.calculateGstBreakdown(finalPayableAmount);

    // If 100% coupon discount (payableAmount === 0), auto-fulfill payment without gateway call
    if (finalPayableAmount === 0) {
      const paymentRecord = await PaymentRepository.create(restaurantId, {
        orderId: orderId || `AUTO_${Date.now()}`,
        paymentId: `pay_free_${Date.now()}`,
        gatewayOrderId: `order_free_${Date.now()}`,
        gateway: 'coupon_100_percent',
        amount: 0,
        currency,
        status: PaymentStatus.SUCCESS,
        paymentMethod: 'coupon_free',
        transactionId: `txn_free_${Date.now()}`,
        paymentCategory,
        targetEntity,
        appliedCoupon: couponDiscountDetails,
        gstDetails: gstBreakdown,
        metadata,
      });

      logger.info(
        { restaurantId, paymentId: paymentRecord.paymentId, couponCode },
        '100% Coupon Payment auto-fulfilled successfully'
      );

      return paymentRecord;
    }

    const gateway = this._getGateway();

    // 1. Create order with gateway interface
    const gatewayResponse = await gateway.createOrder({
      amount: finalPayableAmount,
      currency,
      orderId: orderId || `ORD_${Date.now()}`,
      paymentMethod,
      metadata: { ...metadata, paymentCategory, couponCode },
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
      paymentCategory,
      targetEntity,
      appliedCoupon: couponDiscountDetails,
      gstDetails: gstBreakdown,
      metadata: gatewayResponse.metadata,
    });

    logger.info(
      { restaurantId, paymentId: paymentRecord.paymentId, amount: paymentRecord.amount, category: paymentCategory },
      'Payment Service: Created payment order'
    );

    return paymentRecord;
  }

  /**
   * 1. Restaurant Owner Onboarding Security Deposit Payment (₹1,950).
   */
  async createOnboardingPayment(restaurantId, { couponCode } = {}) {
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant not found.');
    }

    if (restaurant.onboarding?.securityFeePaid) {
      throw new AppError(400, 'Onboarding security fee has already been paid for this restaurant.');
    }

    const baseFee = 1950;

    const payment = await this.createPayment(restaurantId, {
      amount: baseFee,
      currency: 'INR',
      orderId: `ONBOARDING_${restaurantId}_${Date.now()}`,
      paymentMethod: 'upi',
      paymentCategory: PaymentCategory.ONBOARDING_FEE,
      targetEntity: { entityType: 'Restaurant', entityId: restaurantId.toString() },
      couponCode,
      metadata: { restaurantName: restaurant.name, ownerName: restaurant.owner?.fullName },
    });

    await Restaurant.findByIdAndUpdate(restaurantId, {
      'onboarding.stage': 'pending_payment',
      'onboarding.feePaymentId': payment.paymentId,
    });

    return payment;
  }

  /**
   * Verifies Onboarding Security Deposit Payment & updates stage to 'pending_approval'.
   */
  async verifyOnboardingPayment(restaurantId, { paymentId, forceStatus }) {
    const verifiedPayment = await this.verifyPayment(restaurantId, { paymentId, forceStatus });

    if (verifiedPayment.status !== PaymentStatus.SUCCESS) {
      throw new AppError(400, `Onboarding payment verification failed. Status: '${verifiedPayment.status}'.`);
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant not found.');
    }

    // Generate GST Tax Invoice for Onboarding Security Deposit
    const taxInvoice = InvoiceService.generateTaxInvoice({
      invoiceCategory: 'ONBOARDING_SECURITY_DEPOSIT',
      billTo: {
        name: restaurant.owner?.fullName || restaurant.name,
        email: restaurant.owner?.email || '',
        mobile: restaurant.owner?.mobile || '',
        gstin: restaurant.legal?.gstin || 'UNREGISTERED',
        address: restaurant.location?.address || 'India',
      },
      items: [
        {
          description: 'MenuDot Merchant Account Verification & Onboarding Security Deposit',
          hsnSac: '998313',
          quantity: 1,
          unitPrice: verifiedPayment.amount,
          taxableAmount: verifiedPayment.amount,
        },
      ],
      paymentId: verifiedPayment.paymentId,
      totalAmount: verifiedPayment.amount,
    });

    // Update payment record with invoice number
    await PaymentRepository.update(restaurantId, verifiedPayment.paymentId, {
      invoiceNumber: taxInvoice.invoiceNumber,
    });

    // Update restaurant onboarding stage to 'pending_approval' for platform admin verification
    await Restaurant.findByIdAndUpdate(restaurantId, {
      'onboarding.stage': 'pending_approval',
      'onboarding.securityFeePaid': true,
      'onboarding.feePaymentId': verifiedPayment.paymentId,
      'commercials.onboardingFeePaid': true,
    });

    logger.info(
      { restaurantId, paymentId: verifiedPayment.paymentId, invoiceNumber: taxInvoice.invoiceNumber },
      'Onboarding security fee verified successfully. Restaurant stage updated to pending_approval.'
    );

    return {
      payment: verifiedPayment,
      invoice: taxInvoice,
      onboardingStage: 'pending_approval',
    };
  }

  /**
   * 2. Table QR Dine-in Order Payment.
   */
  async createQROrderPayment(restaurantId, { orderId, paymentMethod = 'upi', couponCode }) {
    const order = await OrderRepository.findById(restaurantId, orderId);
    if (!order) {
      throw new AppError(404, `Order '${orderId}' not found.`);
    }

    const payment = await this.createPayment(restaurantId, {
      amount: order.totals.grandTotal,
      currency: 'INR',
      orderId: order._id.toString(),
      paymentMethod,
      paymentCategory: PaymentCategory.TABLE_QR_ORDER,
      targetEntity: { entityType: 'Order', entityId: order._id.toString() },
      couponCode,
      metadata: { tableNumber: order.tableNumber },
    });

    return payment;
  }

  /**
   * 3. Merchant Ads & Campaign Spend Payment.
   */
  async createCampaignPayment(restaurantId, { campaignId, budgetAmount, couponCode }) {
    if (!budgetAmount || budgetAmount <= 0) {
      throw new AppError(400, 'Campaign budget amount must be greater than 0.');
    }

    const payment = await this.createPayment(restaurantId, {
      amount: budgetAmount,
      currency: 'INR',
      orderId: `CAMPAIGN_${campaignId}_${Date.now()}`,
      paymentMethod: 'upi',
      paymentCategory: PaymentCategory.MERCHANT_AD_CAMPAIGN,
      targetEntity: { entityType: 'AdCreative', entityId: campaignId },
      couponCode,
      metadata: { campaignId },
    });

    return payment;
  }

  /**
   * 4. SaaS Software Subscription License Payment.
   */
  async createSubscriptionPayment(restaurantId, { planTier = 'pro', billingCycle = 'monthly', couponCode }) {
    const planPrices = { starter: 999, pro: 2499, enterprise: 4999 };
    const price = planPrices[planTier.toLowerCase()] || 2499;

    const payment = await this.createPayment(restaurantId, {
      amount: price,
      currency: 'INR',
      orderId: `SUB_${planTier.toUpperCase()}_${Date.now()}`,
      paymentMethod: 'upi',
      paymentCategory: PaymentCategory.SUBSCRIPTION_FEE,
      targetEntity: { entityType: 'Subscription', entityId: `${restaurantId}_${planTier}` },
      couponCode,
      metadata: { planTier, billingCycle },
    });

    return payment;
  }

  /**
   * 5. Calculate Daily Merchant Settlement & Payout.
   */
  async calculateDailyMerchantSettlement(restaurantId, dateStr) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const payments = await PaymentRepository.findAll(restaurantId, {
      status: PaymentStatus.SUCCESS,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    const grossCollected = payments.reduce((sum, p) => sum + p.amount, 0);
    const platformCommissionPercent = 5; // 5% platform charge
    const gatewayFeePercent = 2; // 2% gateway charge

    const commissionAmount = Math.round((grossCollected * (platformCommissionPercent / 100)) * 100) / 100;
    const gatewayFeeAmount = Math.round((grossCollected * (gatewayFeePercent / 100)) * 100) / 100;
    const netPayout = Math.max(0, grossCollected - commissionAmount - gatewayFeeAmount);

    return {
      date: startOfDay.toISOString().split('T')[0],
      totalTransactions: payments.length,
      grossCollected,
      deductions: {
        platformCommission: commissionAmount,
        gatewayFee: gatewayFeeAmount,
        totalDeductions: commissionAmount + gatewayFeeAmount,
      },
      netPayout,
      status: 'calculated',
    };
  }

  /**
   * Low-level verification helper.
   */
  async verifyPayment(restaurantId, verificationInput) {
    const { paymentId, gatewayOrderId, forceStatus } = verificationInput;

    if (!paymentId && !gatewayOrderId) {
      throw new AppError(400, 'Must provide paymentId or gatewayOrderId for verification.');
    }

    const targetId = paymentId || gatewayOrderId;
    const existingPayment = await PaymentRepository.findByIdOrPaymentId(restaurantId, targetId);

    if (!existingPayment) {
      throw new AppError(404, `Payment record not found for ID '${targetId}'.`);
    }

    const gateway = this._getGateway();

    const verificationResult = await gateway.verifyPayment({
      paymentId: existingPayment.paymentId,
      gatewayOrderId: existingPayment.gatewayOrderId,
      forceStatus,
    });

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

    const refundResult = await gateway.refund({
      paymentId: existingPayment.paymentId,
      amount: refundAmount,
      reason,
    });

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
   */
  async getPaymentHistory(restaurantId, filters = {}) {
    return PaymentRepository.findAll(restaurantId, filters);
  }

  /**
   * Development-Only Helper to force mock payment status updates.
   */
  async forceMockResult(restaurantId, paymentId, status) {
    if (!Object.values(PaymentStatus).includes(status)) {
      throw new AppError(400, `Invalid status '${status}'. Supported statuses: ${Object.values(PaymentStatus).join(', ')}`);
    }

    return this.verifyPayment(restaurantId, { paymentId, forceStatus: status });
  }
}

module.exports = new PaymentService();
