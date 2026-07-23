delete process.env.SMTP_HOST;
const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, cleanupTestDB, clearDBCollections } = require('./helpers');
const User = require('../src/models/user.model');
const Restaurant = require('../src/models/restaurant.model');
const Payment = require('../src/models/payment.model');
const Coupon = require('../src/models/coupon.model');
const PlatformAuditLog = require('../src/models/platformAuditLog.model');
const { generateAccessToken } = require('../src/utils/jwt.util');

describe('Platform Developer & Super Admin Full Test Suite', () => {
  let superAdminToken;
  let financeAdminToken;
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

    // 1. Create Super Admin User
    const superAdmin = await User.create({
      fullName: 'Super Dev Admin',
      email: 'devadmin@menudot.com',
      mobile: '+919999988881',
      passwordHash: 'password123',
      globalRole: 'super_admin',
      status: 'active',
    });
    superAdminToken = generateAccessToken(superAdmin, 'user');

    // 2. Create Finance Admin User
    const financeAdmin = await User.create({
      fullName: 'Finance Admin',
      email: 'finance@menudot.com',
      mobile: '+919999988882',
      passwordHash: 'password123',
      globalRole: 'finance',
      status: 'active',
    });
    financeAdminToken = generateAccessToken(financeAdmin, 'user');

    // 3. Create a Restaurant owner & restaurant in pending_approval stage
    const owner = await User.create({
      fullName: 'Bistro Owner',
      email: 'owner@bistro.com',
      mobile: '+919999988883',
      passwordHash: 'password123',
      globalRole: 'restaurant_user',
      status: 'suspended',
    });

    const restaurant = await Restaurant.create({
      name: 'Dev Platform Bistro',
      slug: 'dev-platform-bistro',
      owner: {
        userId: owner._id,
        fullName: owner.fullName,
        email: owner.email,
        mobile: owner.mobile,
      },
      location: {
        address: '123 Dev Street',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        geo: { type: 'Point', coordinates: [78.4, 17.4] },
      },
      schedule: {
        workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        openTime: '10:00',
        closeTime: '23:00',
      },
      outletType: 'dine_in_and_delivery',
      legal: {
        pan: 'ABCDE1234F',
        gstin: '36ABCDE1234F1Z5',
        fssaiNumber: '12345678901234',
        fssaiExpiry: '2028-12-31',
      },
      bank: {
        ifsc: 'SBIN0001234',
        accountNumber: '987654321012',
      },
      menuProfile: {
        foodType: 'both',
        cuisines: ['Continental'],
        costForTwo: 800,
      },
      onboarding: {
        stage: 'pending_approval',
        securityFeePaid: true,
        feeAmount: 1950,
        feePaymentId: 'pay_onboarding_test_101',
      },
    });
    restaurantId = restaurant._id.toString();
  });

  describe('1. Onboarding & Verification Stage Alignment with ₹1,950 Fee', () => {
    it('should include pending_approval applications in admin queue and approve application', async () => {
      // 1. Fetch pending onboardings as Super Admin
      const pendingRes = await request(app)
        .get('/api/v1/platform/restaurants/onboarding/pending')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(pendingRes.body.success).toBe(true);
      expect(pendingRes.body.data.length).toBeGreaterThan(0);
      expect(pendingRes.body.data[0].onboarding.stage).toBe('pending_approval');
      expect(pendingRes.body.data[0].onboarding.securityFeePaid).toBe(true);

      // 2. Mark documents verified
      const docRes = await request(app)
        .post(`/api/v1/platform/restaurants/onboarding/${restaurantId}/verify`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ docType: 'pan', isVerified: true })
        .expect(200);

      expect(docRes.body.success).toBe(true);

      // Verify all docs
      await request(app)
        .post(`/api/v1/platform/restaurants/onboarding/${restaurantId}/verify`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ docType: 'gstin', isVerified: true });
      await request(app)
        .post(`/api/v1/platform/restaurants/onboarding/${restaurantId}/verify`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ docType: 'fssai', isVerified: true });
      await request(app)
        .post(`/api/v1/platform/restaurants/onboarding/${restaurantId}/verify`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ docType: 'bank', isVerified: true });

      // 3. Review & Approve application
      const reviewRes = await request(app)
        .post(`/api/v1/platform/restaurants/onboarding/${restaurantId}/review`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ action: 'approve' })
        .expect(200);

      expect(reviewRes.body.success).toBe(true);

      const updated = await Restaurant.findById(restaurantId);
      expect(updated.onboarding.stage).toBe('approved');
    });
  });

  describe('2. Platform Financial Control Tower & Merchant Payout Disburser', () => {
    it('should retrieve global financial metrics and process merchant payout disbursement', async () => {
      // 1. Seed successful onboarding fee payment & QR order payment
      await Payment.create({
        restaurantId,
        orderId: 'ONBOARDING_TEST_1',
        paymentId: 'pay_onboard_101',
        gateway: 'mock',
        amount: 1950,
        status: 'SUCCESS',
        paymentCategory: 'onboarding_security_fee',
      });

      await Payment.create({
        restaurantId,
        orderId: 'ORD_QR_TEST_1',
        paymentId: 'pay_qr_101',
        gateway: 'mock',
        amount: 1000,
        status: 'SUCCESS',
        paymentCategory: 'table_qr_order',
      });

      // 2. Fetch platform financial overview
      const overviewRes = await request(app)
        .get('/api/v1/platform/finance/overview')
        .set('Authorization', `Bearer ${financeAdminToken}`)
        .expect(200);

      expect(overviewRes.body.success).toBe(true);
      expect(overviewRes.body.data.overview.grossVolume).toBe(2950); // 1950 + 1000
      expect(overviewRes.body.data.overview.onboardingFeesCollected).toBe(1950);
      expect(overviewRes.body.data.overview.qrOrdersVolume).toBe(1000);
      expect(overviewRes.body.data.overview.platformCommissionEarned).toBe(50); // 5% of 1000

      // 3. Disburse merchant bank payout
      const disburseRes = await request(app)
        .post(`/api/v1/platform/finance/settlements/${restaurantId}/disburse`)
        .set('Authorization', `Bearer ${financeAdminToken}`)
        .send({ amount: 930, bankReferenceId: 'HDFC12345678' })
        .expect(200);

      expect(disburseRes.body.success).toBe(true);
      expect(disburseRes.body.data.status).toBe('DISBURSED');

      // Verify audit log
      const auditLog = await PlatformAuditLog.findOne({ action: 'DISBURSE_MERCHANT_SETTLEMENT' });
      expect(auditLog).toBeDefined();
      expect(auditLog.details.amount).toBe(930);
    });

    it('should update restaurant SaaS subscription tier via admin control', async () => {
      const subRes = await request(app)
        .patch(`/api/v1/platform/finance/subscriptions/${restaurantId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ planTier: 'enterprise', extendDays: 30 })
        .expect(200);

      expect(subRes.body.success).toBe(true);
      expect(subRes.body.data.plan).toBe('enterprise');
    });
  });

  describe('3. Aggregator Integration Webhook Logs', () => {
    it('should retrieve aggregator integration health logs', async () => {
      const logRes = await request(app)
        .get('/api/v1/platform/system/integrations/logs')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(logRes.body.success).toBe(true);
      expect(logRes.body.data.logs.length).toBeGreaterThan(0);
    });
  });

  describe('4. Platform Coupon & Campaign Controls', () => {
    it('should allow platform admin to update and delete platform coupons', async () => {
      const now = new Date();
      const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const coupon = await Coupon.create({
        code: 'ADMINFESTIVE',
        scope: 'platform',
        targetType: 'cart',
        discountType: 'flat',
        discountValue: 100,
        startDate: now,
        endDate: nextMonth,
        status: 'active',
      });

      // Update coupon
      const updateRes = await request(app)
        .patch(`/api/v1/platform/coupons/${coupon._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ discountValue: 150 })
        .expect(200);

      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.discountValue).toBe(150);

      // Delete coupon
      const deleteRes = await request(app)
        .delete(`/api/v1/platform/coupons/${coupon._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(deleteRes.body.success).toBe(true);
    });
  });
});
