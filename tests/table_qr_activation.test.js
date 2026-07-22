delete process.env.SMTP_HOST;
const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, cleanupTestDB, clearDBCollections, registerAndApproveRestaurant } = require('./helpers');
const Table = require('../src/models/table.model');
const MenuCategory = require('../src/models/menuCategory.model');
const MenuItem = require('../src/models/menuItem.model');

describe('Dual-Flow Table QR Code Activation Tests (Pre-Booked vs Direct Walk-In)', () => {
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

    // Create default menu category & item for catalog tests
    const category = await MenuCategory.create({
      restaurantId,
      name: 'Starters',
      slug: 'starters',
      displayOrder: 1,
    });

    await MenuItem.create({
      restaurantId,
      categoryId: category._id,
      name: 'Paneer Tikka',
      price: 280,
      foodType: 'veg',
    });
  });

  describe('1. Pre-Booked Customer Coupon Direct QR Activation', () => {
    it('should directly activate table QR scanning when staff verifies customer booking coupon code', async () => {
      // 1. Staff creates table T-01 (default qrCode.isActive = false)
      const tableRes = await request(app)
        .post('/api/v1/tables')
        .set(restaurantContext.headers)
        .send({ tableNumber: 'T-01', capacity: 4 })
        .expect(201);

      const tableId = tableRes.body.data._id;
      const initialTable = await Table.findById(tableId);
      expect(initialTable.qrCode.isActive).toBe(false);

      // 2. Anonymous Web Slot Booking
      const bookingRes = await request(app)
        .post('/api/v1/bookings/public/create')
        .send({
          restaurantId,
          customerName: 'George Mason',
          customerEmail: 'george@example.com',
          customerMobile: '+919876543210',
          numberOfPeople: 2,
          bookingDate: '2026-07-26',
          timeSlot: '20:00',
        })
        .expect(201);

      // 3. Payment verification generates coupon
      const verifyPaymentRes = await request(app)
        .post('/api/v1/bookings/public/verify-payment')
        .send({
          restaurantId,
          bookingId: bookingRes.body.data.booking.id,
          paymentId: bookingRes.body.data.payment.paymentId,
        })
        .expect(200);

      const couponCode = verifyPaymentRes.body.data.couponCode;

      // 4. Staff verifies coupon code on arrival
      const redeemRes = await request(app)
        .post('/api/v1/bookings/verify-coupon')
        .set(restaurantContext.headers)
        .send({
          couponCode,
          tableNumber: 'T-01',
        })
        .expect(200);

      expect(redeemRes.body.success).toBe(true);
      expect(redeemRes.body.data.table.qrCodeActive).toBe(true);

      // Verify table state in DB: qrCode.isActive is TRUE directly
      const updatedTable = await Table.findById(tableId);
      expect(updatedTable.qrCode.isActive).toBe(true);
      expect(updatedTable.status).toBe('occupied');

      // Pre-booked customer scans QR code token -> succeeds immediately
      const scanRes = await request(app)
        .post('/api/v1/tables/scan')
        .send({
          code: updatedTable.qrCode.code,
          customerName: 'George Mason',
          numberOfPeople: 2,
          deviceId: 'device_george_123',
        })
        .expect(200);

      expect(scanRes.body.success).toBe(true);
      expect(scanRes.body.data.menu).toBeDefined();
    });
  });

  describe('2. Direct Walk-In Customer QR Access Request & Staff Unlock Approval', () => {
    it('should notify staff on inactive scan, record pending request, and allow staff to unlock table access', async () => {
      // 1. Staff creates table T-02 (default qrCode.isActive = false)
      const tableRes = await request(app)
        .post('/api/v1/tables')
        .set(restaurantContext.headers)
        .send({ tableNumber: 'T-02', capacity: 4 })
        .expect(201);

      const tableId = tableRes.body.data._id;
      const qrCodeToken = tableRes.body.data.qrCode.code;

      // 2. Direct Walk-In Customer scans inactive QR code
      const scanRes = await request(app)
        .post('/api/v1/tables/scan')
        .send({
          code: qrCodeToken,
          customerName: 'Hannah Abbott',
          numberOfPeople: 3,
          deviceId: 'device_hannah_456',
        })
        .expect(403);

      expect(scanRes.body.success).toBe(false);
      expect(scanRes.body.errors.status).toBe('activation_pending');
      expect(scanRes.body.errors.tableNumber).toBe('T-02');

      // DB check: pending request recorded
      const tableInDb = await Table.findById(tableId);
      expect(tableInDb.qrUnlockRequest.requested).toBe(true);
      expect(tableInDb.qrUnlockRequest.customerName).toBe('Hannah Abbott');
      expect(tableInDb.qrCode.isActive).toBe(false);

      // 3. Staff checks pending unlock requests
      const pendingRes = await request(app)
        .get('/api/v1/tables/staff/pending-unlock-requests')
        .set(restaurantContext.headers)
        .expect(200);

      expect(pendingRes.body.success).toBe(true);
      expect(pendingRes.body.data.length).toBeGreaterThanOrEqual(1);
      const pendingTableNumbers = pendingRes.body.data.map((t) => t.tableNumber);
      expect(pendingTableNumbers).toContain('T-02');

      // 4. Staff approves unlock access
      const unlockRes = await request(app)
        .post(`/api/v1/tables/${tableId}/unlock-access`)
        .set(restaurantContext.headers)
        .send({
          customerName: 'Hannah Abbott',
          numberOfPeople: 3,
          deviceId: 'device_hannah_456',
        })
        .expect(200);

      expect(unlockRes.body.success).toBe(true);
      expect(unlockRes.body.data.qrCode.isActive).toBe(true);
      expect(unlockRes.body.data.status).toBe('occupied');
      expect(unlockRes.body.data.qrUnlockRequest.requested).toBe(false);

      // 5. Customer re-scans -> succeeds and loads full catalog
      const rescanRes = await request(app)
        .post('/api/v1/tables/scan')
        .send({
          code: qrCodeToken,
          customerName: 'Hannah Abbott',
          numberOfPeople: 3,
          deviceId: 'device_hannah_456',
        })
        .expect(200);

      expect(rescanRes.body.success).toBe(true);
      expect(rescanRes.body.data.menu).toBeDefined();
    });
  });
});
