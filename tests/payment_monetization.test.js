delete process.env.SMTP_HOST;
const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, cleanupTestDB, clearDBCollections, registerAndApproveRestaurant } = require('./helpers');
const Restaurant = require('../src/models/restaurant.model');
const Order = require('../src/models/order.model');
const Coupon = require('../src/models/coupon.model');
const Payment = require('../src/models/payment.model');

describe('Payment & Monetization Architecture Test Suite', () => {
  let restaurantContext;
  let restaurantId;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  beforeEach(async () => {
    delete process.env.SMTP_HOST;
    await clearDBCollections();
    const admin = { token: 'mockPlatformAdmin' };
    restaurantContext = await registerAndApproveRestaurant(admin.token);
    restaurantId = restaurantContext.restaurant._id.toString();
  });

  describe('1. Restaurant Owner Onboarding Security Fee Payment (₹1,950)', () => {
    it('should initiate ₹1,950 onboarding fee payment and update stage to pending_approval upon verification with GST invoice', async () => {
      // 1. Initiate onboarding payment
      const initRes = await request(app)
        .post('/api/v1/payments/onboarding/initiate')
        .send({ restaurantId })
        .expect(201);

      expect(initRes.body.success).toBe(true);
      expect(initRes.body.data.amount).toBe(1950);
      expect(initRes.body.data.paymentCategory).toBe('onboarding_security_fee');
      const paymentId = initRes.body.data.paymentId;

      // Check DB: onboarding stage is pending_payment
      let restaurant = await Restaurant.findById(restaurantId);
      expect(restaurant.onboarding.stage).toBe('pending_payment');

      // 2. Verify payment
      const verifyRes = await request(app)
        .post('/api/v1/payments/onboarding/verify')
        .send({ restaurantId, paymentId })
        .expect(200);

      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.onboardingStage).toBe('pending_approval');
      expect(verifyRes.body.data.invoice.invoiceNumber).toMatch(/^INV-/);
      expect(verifyRes.body.data.invoice.pricing.totalAmount).toBe(1950);
      expect(verifyRes.body.data.invoice.pricing.baseAmount).toBe(1652.54); // 1950 / 1.18

      // Check DB: onboarding stage updated to pending_approval
      restaurant = await Restaurant.findById(restaurantId);
      expect(restaurant.onboarding.stage).toBe('pending_approval');
      expect(restaurant.onboarding.securityFeePaid).toBe(true);
    });
  });

  describe('2. Payment Coupon Integration & 100% Discount Auto-Fulfillment', () => {
    it('should apply percentage coupon discount during payment creation and auto-fulfill 100% discount coupons', async () => {
      const now = new Date();
      const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // 1. Create 50% discount coupon
      await Coupon.create({
        code: 'HALFPRICE',
        scope: 'platform',
        targetType: 'cart',
        discountType: 'percentage',
        discountValue: 50,
        minOrderValue: 0,
        startDate: now,
        endDate: nextMonth,
        status: 'active',
      });

      // 2. Initiate payment with 50% coupon on ₹1,000 order -> ₹500 payable
      const initRes = await request(app)
        .post('/api/v1/payments/create')
        .set(restaurantContext.headers)
        .send({
          amount: 1000,
          currency: 'INR',
          orderId: 'ORD_COUPON_TEST',
          paymentMethod: 'upi',
          couponCode: 'HALFPRICE',
        })
        .expect(201);

      expect(initRes.body.success).toBe(true);
      expect(initRes.body.data.amount).toBe(500); // 1000 - 500 = ₹500
      expect(initRes.body.data.appliedCoupon.code).toBe('HALFPRICE');
      expect(initRes.body.data.appliedCoupon.discountAmount).toBe(500);

      // 3. Create 100% discount coupon
      await Coupon.create({
        code: 'FREEPASS',
        scope: 'platform',
        targetType: 'cart',
        discountType: 'percentage',
        discountValue: 100,
        minOrderValue: 0,
        startDate: now,
        endDate: nextMonth,
        status: 'active',
      });

      // 4. Initiate payment with 100% coupon -> payable amount ₹0 -> status SUCCESS automatically!
      const freeRes = await request(app)
        .post('/api/v1/payments/create')
        .set(restaurantContext.headers)
        .send({
          amount: 500,
          currency: 'INR',
          orderId: 'ORD_FREE_TEST',
          paymentMethod: 'upi',
          couponCode: 'FREEPASS',
        })
        .expect(201);

      expect(freeRes.body.success).toBe(true);
      expect(freeRes.body.data.amount).toBe(0);
      expect(freeRes.body.data.status).toBe('SUCCESS');
      expect(freeRes.body.data.gateway).toBe('coupon_100_percent');
    });
  });

  describe('3. Table QR Order Payment', () => {
    it('should initiate table QR order payment and verify success', async () => {
      // 1. Create dine-in order
      const order = await Order.create({
        restaurantId,
        orderSource: 'dine_in',
        tableNumber: 'T-01',
        items: [{ itemId: restaurantId, name: 'Pizza', price: 500, quantity: 1 }],
        totals: { subtotal: 500, tax: 25, grandTotal: 525 },
        status: 'received',
      });

      // 2. Initiate QR order payment
      const initRes = await request(app)
        .post('/api/v1/payments/qr-order/initiate')
        .set(restaurantContext.headers)
        .send({
          orderId: order._id.toString(),
          paymentMethod: 'upi',
        })
        .expect(201);

      expect(initRes.body.success).toBe(true);
      expect(initRes.body.data.amount).toBe(525);
      expect(initRes.body.data.paymentCategory).toBe('table_qr_order');
    });
  });

  describe('4. Merchant Ad Campaign & SaaS Subscription Payments', () => {
    it('should initiate merchant ad campaign payment and SaaS subscription payment', async () => {
      // 1. Ad Campaign Payment
      const adRes = await request(app)
        .post('/api/v1/payments/campaigns/initiate')
        .set(restaurantContext.headers)
        .send({
          campaignId: 'CAMPAIGN_FESTIVE_101',
          budgetAmount: 2000,
        })
        .expect(201);

      expect(adRes.body.success).toBe(true);
      expect(adRes.body.data.amount).toBe(2000);
      expect(adRes.body.data.paymentCategory).toBe('merchant_ad_campaign');

      // 2. Pro SaaS Subscription Payment
      const subRes = await request(app)
        .post('/api/v1/payments/subscriptions/initiate')
        .set(restaurantContext.headers)
        .send({
          planTier: 'pro',
          billingCycle: 'monthly',
        })
        .expect(201);

      expect(subRes.body.success).toBe(true);
      expect(subRes.body.data.amount).toBe(2499);
      expect(subRes.body.data.paymentCategory).toBe('subscription_fee');
    });
  });

  describe('5. Daily Merchant Settlement & Payout Report', () => {
    it('should calculate gross online payments, platform commission, gateway fees, and net payout', async () => {
      // Create a successful payment for today
      await Payment.create({
        restaurantId,
        orderId: 'ORD_SETTLE_1',
        paymentId: `pay_settle_${Date.now()}`,
        gateway: 'mock',
        amount: 1000, // ₹1,000 gross
        status: 'SUCCESS',
        paymentCategory: 'table_qr_order',
      });

      const res = await request(app)
        .get('/api/v1/payments/settlement/daily')
        .set(restaurantContext.headers)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.grossCollected).toBe(1000);
      expect(res.body.data.deductions.platformCommission).toBe(50); // 5% commission = ₹50
      expect(res.body.data.deductions.gatewayFee).toBe(20); // 2% gateway fee = ₹20
      expect(res.body.data.netPayout).toBe(930); // 1000 - 70 = ₹930
    });
  });
});
