const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, cleanupTestDB, clearDBCollections, registerAndApproveRestaurant } = require('./helpers');
const paymentFactory = require('../src/gateways/payment/factory/payment.factory');
const MockPaymentGateway = require('../src/gateways/payment/mock/mockPayment.gateway');
const PaymentGatewayInterface = require('../src/gateways/payment/interfaces/paymentGateway.interface');
const { PaymentStatus, RefundStatus, PaymentMethod } = require('../src/gateways/payment/types/payment.types');
const Payment = require('../src/models/payment.model');

describe('Payment Gateway & Mock Provider Integration Tests', () => {
  let restaurantContext;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  beforeEach(async () => {
    await clearDBCollections();
    const admin = { token: 'mockPlatformAdmin' };
    restaurantContext = await registerAndApproveRestaurant(admin.token);
  });

  describe('1. Gateway Interface & Mock Implementation', () => {
    it('should throw errors if PaymentGatewayInterface methods are invoked directly without implementation', async () => {
      const baseInterface = new PaymentGatewayInterface();
      await expect(baseInterface.createOrder({})).rejects.toThrow('Method createOrder() must be implemented.');
      await expect(baseInterface.verifyPayment({})).rejects.toThrow('Method verifyPayment() must be implemented.');
      await expect(baseInterface.capturePayment('id', 100)).rejects.toThrow('Method capturePayment() must be implemented.');
      await expect(baseInterface.refund({})).rejects.toThrow('Method refund() must be implemented.');
      await expect(baseInterface.cancelPayment('id')).rejects.toThrow('Method cancelPayment() must be implemented.');
    });

    it('should return mock orders with realistic IDs from MockPaymentGateway offline', async () => {
      const mockGateway = new MockPaymentGateway();
      const order = await mockGateway.createOrder({
        amount: 499,
        currency: 'INR',
        orderId: 'ORD_TEST_100',
        paymentMethod: PaymentMethod.UPI,
      });

      expect(order.gateway).toBe('mock');
      expect(order.paymentId).toMatch(/^pay_mock_/);
      expect(order.gatewayOrderId).toMatch(/^order_mock_/);
      expect(order.transactionId).toMatch(/^txn_mock_/);
      expect(order.amount).toBe(499);
      expect(order.status).toBe(PaymentStatus.PENDING);
    });

    it('should select MockPaymentGateway by default via PaymentFactory', () => {
      const gateway = paymentFactory.getGateway('mock');
      expect(gateway).toBeInstanceOf(MockPaymentGateway);
      expect(gateway.name).toBe('mock');
    });

    it('should fall back to MockPaymentGateway if configured mode is not loaded yet', () => {
      const gateway = paymentFactory.getGateway('razorpay');
      expect(gateway).toBeInstanceOf(MockPaymentGateway);
    });
  });

  describe('2. Payment API Endpoints', () => {
    it('should create a mock payment via POST /api/v1/payments/create', async () => {
      const res = await request(app)
        .post('/api/v1/payments/create')
        .set(restaurantContext.headers)
        .send({
          amount: 750,
          currency: 'INR',
          orderId: 'ORD_TABLE_4',
          paymentMethod: 'upi',
          metadata: { note: 'Dine-in lunch' },
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentId).toMatch(/^pay_mock_/);
      expect(res.body.data.amount).toBe(750);
      expect(res.body.data.status).toBe(PaymentStatus.PENDING);

      // Verify DB record
      const dbPayment = await Payment.findOne({ paymentId: res.body.data.paymentId });
      expect(dbPayment).not.toBeNull();
      expect(dbPayment.amount).toBe(750);
    });

    it('should verify payment status via POST /api/v1/payments/verify', async () => {
      // 1. Create order
      const createRes = await request(app)
        .post('/api/v1/payments/create')
        .set(restaurantContext.headers)
        .send({ amount: 1200, orderId: 'ORD_TABLE_9' })
        .expect(201);

      const paymentId = createRes.body.data.paymentId;

      // 2. Verify payment
      const verifyRes = await request(app)
        .post('/api/v1/payments/verify')
        .set(restaurantContext.headers)
        .send({ paymentId })
        .expect(200);

      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.status).toBe(PaymentStatus.SUCCESS);
      expect(verifyRes.body.data.transactionId).toMatch(/^txn_mock_/);

      // Verify updated DB status
      const dbPayment = await Payment.findOne({ paymentId });
      expect(dbPayment.status).toBe(PaymentStatus.SUCCESS);
    });

    it('should refund a successful payment via POST /api/v1/payments/refund', async () => {
      // Create and verify payment
      const createRes = await request(app)
        .post('/api/v1/payments/create')
        .set(restaurantContext.headers)
        .send({ amount: 350, orderId: 'ORD_REFUND_TEST' })
        .expect(201);

      const paymentId = createRes.body.data.paymentId;

      await request(app)
        .post('/api/v1/payments/verify')
        .set(restaurantContext.headers)
        .send({ paymentId })
        .expect(200);

      // Trigger refund
      const refundRes = await request(app)
        .post('/api/v1/payments/refund')
        .set(restaurantContext.headers)
        .send({
          paymentId,
          amount: 350,
          reason: 'Customer requested refund due to delay',
        })
        .expect(200);

      expect(refundRes.body.success).toBe(true);
      expect(refundRes.body.data.refundDetails.status).toBe(RefundStatus.SUCCESS);
      expect(refundRes.body.data.refundDetails.refundId).toMatch(/^rfnd_mock_/);
    });

    it('should fetch payment details by ID via GET /api/v1/payments/:id', async () => {
      const createRes = await request(app)
        .post('/api/v1/payments/create')
        .set(restaurantContext.headers)
        .send({ amount: 600, orderId: 'ORD_GET_TEST' })
        .expect(201);

      const paymentId = createRes.body.data.paymentId;

      const getRes = await request(app)
        .get(`/api/v1/payments/${paymentId}`)
        .set(restaurantContext.headers)
        .expect(200);

      expect(getRes.body.data.paymentId).toBe(paymentId);
      expect(getRes.body.data.amount).toBe(600);
    });

    it('should list payment history via GET /api/v1/payments/history', async () => {
      await request(app)
        .post('/api/v1/payments/create')
        .set(restaurantContext.headers)
        .send({ amount: 150, orderId: 'ORD_HIST_1' })
        .expect(201);

      await request(app)
        .post('/api/v1/payments/create')
        .set(restaurantContext.headers)
        .send({ amount: 300, orderId: 'ORD_HIST_2' })
        .expect(201);

      const historyRes = await request(app)
        .get('/api/v1/payments/history')
        .set(restaurantContext.headers)
        .expect(200);

      expect(historyRes.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should allow forcing mock status via dev endpoint POST /api/v1/payments/mock/result', async () => {
      const createRes = await request(app)
        .post('/api/v1/payments/create')
        .set(restaurantContext.headers)
        .send({ amount: 800, orderId: 'ORD_DEV_TEST' })
        .expect(201);

      const paymentId = createRes.body.data.paymentId;

      // Force status to FAILED
      const mockRes = await request(app)
        .post('/api/v1/payments/mock/result')
        .set(restaurantContext.headers)
        .send({
          paymentId,
          status: 'FAILED',
        })
        .expect(200);

      expect(mockRes.body.data.status).toBe('FAILED');
    });
  });
});
