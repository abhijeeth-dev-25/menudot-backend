delete process.env.SMTP_HOST;
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const { setupTestDB, cleanupTestDB, clearDBCollections, registerAndApproveRestaurant } = require('./helpers');
const Booking = require('../src/models/booking.model');
const Order = require('../src/models/order.model');
const MenuItem = require('../src/models/menuItem.model');
const MenuCategory = require('../src/models/menuCategory.model');
const Table = require('../src/models/table.model');

describe('Web Slot Booking, Payment, Email Confirmation & Real-Time Restaurant Model Tests', () => {
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

  describe('1. Anonymous Web Slot Booking & Payment Creation', () => {
    it('should calculate ₹20/guest pre-booking fee and create a pending_payment booking', async () => {
      const res = await request(app)
        .post('/api/v1/bookings/public/create')
        .send({
          restaurantId,
          customerName: 'Alice Johnson',
          customerEmail: 'alice@example.com',
          customerMobile: '+919876543210',
          numberOfPeople: 4,
          bookingDate: '2026-07-25',
          timeSlot: '20:00',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.booking.customerEmail).toBe('alice@example.com');
      expect(res.body.data.booking.prebookingFee).toBe(80); // 4 guests * ₹20
      expect(res.body.data.booking.status).toBe('pending_payment');
      expect(res.body.data.payment.paymentId).toMatch(/^pay_mock_/);

      // DB check
      const dbBooking = await Booking.findById(res.body.data.booking.id);
      expect(dbBooking).not.toBeNull();
      expect(dbBooking.prepayment.amount).toBe(80);
      expect(dbBooking.prepayment.status).toBe('pending');
    });
  });

  describe('2. Payment Verification, Coupon Code & Confirmation Email', () => {
    it('should verify payment, generate Coupon Code, update status to confirmed, and generate local email log', async () => {
      // 1. Create booking
      const createRes = await request(app)
        .post('/api/v1/bookings/public/create')
        .send({
          restaurantId,
          customerName: 'Bob Smith',
          customerEmail: 'bob@example.com',
          customerMobile: '+919988776655',
          numberOfPeople: 3, // 3 * ₹20 = ₹60
          bookingDate: '2026-07-25',
          timeSlot: '19:30',
        })
        .expect(201);

      const bookingId = createRes.body.data.booking.id;
      const paymentId = createRes.body.data.payment.paymentId;

      // 2. Verify payment
      const verifyRes = await request(app)
        .post('/api/v1/bookings/public/verify-payment')
        .send({
          restaurantId,
          bookingId,
          paymentId,
        })
        .expect(200);

      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.status).toBe('confirmed');
      expect(verifyRes.body.data.couponCode).toMatch(/^BK[A-Z0-9]{6}$/);
      expect(verifyRes.body.data.prepayment.status).toBe('paid');
      expect(verifyRes.body.data.prepayment.amount).toBe(60);

      // Verify email log file creation in dev logs/emails folder
      const emailLogsDir = path.join(__dirname, '../logs/emails');
      expect(fs.existsSync(emailLogsDir)).toBe(true);
      const files = fs.readdirSync(emailLogsDir);
      const bobLogs = files.filter((f) => f.includes('bob@example.com')).sort();
      const bobEmailLog = bobLogs[bobLogs.length - 1];
      expect(bobEmailLog).toBeDefined();

      const emailContent = fs.readFileSync(path.join(emailLogsDir, bobEmailLog), 'utf-8');
      expect(emailContent).toContain('Your Verification Coupon Code');
      expect(emailContent).toContain(verifyRes.body.data.couponCode);
      expect(emailContent).toContain('₹60');
    });
  });

  describe('3. Staff Coupon Verification, Table Assignment & QR Activation', () => {
    it('should allow staff to verify coupon code, seat customer, assign table, and activate table QR scanning', async () => {
      // 1. Create table
      const tableRes = await request(app)
        .post('/api/v1/tables')
        .set(restaurantContext.headers)
        .send({ tableNumber: 'T-04', capacity: 4 })
        .expect(201);

      // 2. Create and verify booking
      const createRes = await request(app)
        .post('/api/v1/bookings/public/create')
        .send({
          restaurantId,
          customerName: 'Charlie Brown',
          customerEmail: 'charlie@example.com',
          customerMobile: '+919123456789',
          numberOfPeople: 2,
          bookingDate: '2026-07-25',
          timeSlot: '20:30',
        })
        .expect(201);

      const bookingId = createRes.body.data.booking.id;
      const paymentId = createRes.body.data.payment.paymentId;

      const verifyRes = await request(app)
        .post('/api/v1/bookings/public/verify-payment')
        .send({ restaurantId, bookingId, paymentId })
        .expect(200);

      const couponCode = verifyRes.body.data.couponCode;

      // 3. Staff verifies coupon code upon guest arrival
      const redeemRes = await request(app)
        .post('/api/v1/bookings/verify-coupon')
        .set(restaurantContext.headers)
        .send({
          couponCode,
          tableNumber: 'T-04',
        })
        .expect(200);

      expect(redeemRes.body.success).toBe(true);
      expect(redeemRes.body.data.booking.status).toBe('seated');
      expect(redeemRes.body.data.booking.couponActivated).toBe(true);
      expect(redeemRes.body.data.table.qrCodeActive).toBe(true);

      // Verify table state in DB
      const dbTable = await Table.findOne({ restaurantId, tableNumber: 'T-04' });
      expect(dbTable.status).toBe('occupied');
      expect(dbTable.qrCode.isActive).toBe(true);
    });
  });

  describe('4. Final Table Checkout & Prepaid Booking Fee Discount Deduction', () => {
    it('should automatically deduct ₹20/guest prepaid booking fee from final order bill upon checkout', async () => {
      // 1. Create table T-05
      const tableRes = await request(app)
        .post('/api/v1/tables')
        .set(restaurantContext.headers)
        .send({ tableNumber: 'T-05', capacity: 4 })
        .expect(201);

      const tableId = tableRes.body.data._id;

      // 2. Create and verify booking for 4 guests (4 * ₹20 = ₹80 prepaid)
      const createRes = await request(app)
        .post('/api/v1/bookings/public/create')
        .send({
          restaurantId,
          customerName: 'David Miller',
          customerEmail: 'david@example.com',
          customerMobile: '+919777888999',
          numberOfPeople: 4,
          bookingDate: '2026-07-25',
          timeSlot: '21:00',
        })
        .expect(201);

      const bookingId = createRes.body.data.booking.id;
      const paymentId = createRes.body.data.payment.paymentId;

      const verifyRes = await request(app)
        .post('/api/v1/bookings/public/verify-payment')
        .send({ restaurantId, bookingId, paymentId })
        .expect(200);

      // 3. Staff redeems coupon code
      await request(app)
        .post('/api/v1/bookings/verify-coupon')
        .set(restaurantContext.headers)
        .send({
          couponCode: verifyRes.body.data.couponCode,
          tableNumber: 'T-05',
        })
        .expect(200);

      // 4. Create menu category and item
      const category = await MenuCategory.create({
        restaurantId,
        name: 'Main Course',
        slug: 'main-course',
        displayOrder: 1,
      });

      const item = await MenuItem.create({
        restaurantId,
        categoryId: category._id,
        name: 'Butter Chicken',
        price: 400,
        foodType: 'non-veg',
      });

      // 5. Create dine-in order for Table T-05 (2 Butter Chicken = ₹800)
      const order = await Order.create({
        restaurantId,
        orderSource: 'dine_in',
        tableId,
        tableNumber: 'T-05',
        items: [{ itemId: item._id, name: 'Butter Chicken', price: 400, quantity: 2 }],
        status: 'preparing',
        totals: {
          subtotal: 800,
          tax: 40,
          platformCharge: 0,
          discount: 0,
          grandTotal: 840,
        },
      });

      // 6. Checkout Table T-05
      await request(app)
        .post(`/api/v1/tables/${tableId}/checkout`)
        .set(restaurantContext.headers)
        .expect(200);

      // 7. Verify order totals had ₹80 prepaid fee deducted
      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.totals.discount).toBe(80); // ₹80 prepaid booking fee discount
      expect(updatedOrder.totals.grandTotal).toBe(760); // 840 - 80 = ₹760

      // Verify booking status changed to completed
      const updatedBooking = await Booking.findById(bookingId);
      expect(updatedBooking.status).toBe('completed');
    });
  });

  describe('5. Real-Time Walk-In Guest Table Allocation (Conflict Avoidance)', () => {
    it('should return vacant tables while excluding tables reserved for upcoming confirmed bookings', async () => {
      // 1. Create 3 tables: T-01 (vacant), T-02 (vacant), T-03 (vacant)
      await request(app)
        .post('/api/v1/tables')
        .set(restaurantContext.headers)
        .send({ tableNumber: 'T-01', capacity: 2 })
        .expect(201);

      await request(app)
        .post('/api/v1/tables')
        .set(restaurantContext.headers)
        .send({ tableNumber: 'T-02', capacity: 4 })
        .expect(201);

      await request(app)
        .post('/api/v1/tables')
        .set(restaurantContext.headers)
        .send({ tableNumber: 'T-03', capacity: 4 })
        .expect(201);

      const todayStr = new Date().toISOString().split('T')[0];

      // 2. Pre-book table T-02 for today
      const createRes = await request(app)
        .post('/api/v1/bookings/public/create')
        .send({
          restaurantId,
          customerName: 'Eve Walkin',
          customerEmail: 'eve@example.com',
          customerMobile: '+919000000000',
          numberOfPeople: 4,
          bookingDate: todayStr,
          timeSlot: '20:00',
          tableNumber: 'T-02',
        })
        .expect(201);

      await request(app)
        .post('/api/v1/bookings/public/verify-payment')
        .send({
          restaurantId,
          bookingId: createRes.body.data.booking.id,
          paymentId: createRes.body.data.payment.paymentId,
        })
        .expect(200);

      // 3. Query available tables for walk-in guest (party of 4)
      const walkinRes = await request(app)
        .get('/api/v1/bookings/tables/available-for-walkin?numberOfPeople=4&bufferHours=2')
        .set(restaurantContext.headers)
        .expect(200);

      expect(walkinRes.body.success).toBe(true);
      const availableTableNumbers = walkinRes.body.data.tables.map((t) => t.tableNumber);

      // T-02 should be EXCLUDED because it has an upcoming confirmed booking today!
      expect(availableTableNumbers).toContain('T-03');
      expect(availableTableNumbers).not.toContain('T-02');
    });
  });
});
