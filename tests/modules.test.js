const request = require('supertest');
const app = require('../src/app');
const {
  setupTestDB,
  cleanupTestDB,
  clearDBCollections,
  registerAndApproveRestaurant,
} = require('./helpers');
const User = require('../src/models/user.model');
const MenuItem = require('../src/models/menuItem.model');
const MenuCategory = require('../src/models/menuCategory.model');
const Screen = require('../src/models/screen.model');

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await cleanupTestDB();
});

beforeEach(async () => {
  await clearDBCollections();
});

describe('Auxiliary Modules API (Campaigns, Bookings, Inventory, Finance, Feedback, Screens)', () => {
  let ownerHeaders;
  let restaurant;

  beforeEach(async () => {
    const setup = await registerAndApproveRestaurant();
    ownerHeaders = setup.headers;
    restaurant = setup.restaurant;
  });

  describe('Campaigns API (/api/v1/campaigns)', () => {
    test('should allow managing and fetching active campaigns', async () => {
      // 1. Create a menu item to associate with campaign
      const category = new MenuCategory({ name: 'Drinks', slug: 'drinks', restaurantId: restaurant._id });
      await category.save();
      const menuItem = new MenuItem({
        name: 'Cold Coffee',
        categoryId: category._id,
        price: 90,
        foodType: 'veg',
        restaurantId: restaurant._id,
      });
      await menuItem.save();

      // 2. Create campaign (Protected)
      const res = await request(app)
        .post('/api/v1/campaigns')
        .set(ownerHeaders)
        .send({
          name: 'Summer Refreshers Campaign',
          type: 'sponsored_item',
          menuItemId: menuItem._id.toString(),
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          budgetLimit: 5000,
          costPerClick: 5,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Summer Refreshers Campaign');
      const campaignId = res.body.data._id;

      // 3. Fetch active campaigns (Public)
      const activeRes = await request(app)
        .get('/api/v1/campaigns/active')
        .set('x-restaurant-id', restaurant._id.toString())
        .expect(200);

      expect(activeRes.body.success).toBe(true);
      expect(activeRes.body.data.length).toBe(1);

      // 4. Click track (Public)
      await request(app)
        .post(`/api/v1/campaigns/${campaignId}/click`)
        .set('x-restaurant-id', restaurant._id.toString())
        .expect(200);
    });
  });

  describe('Bookings API (/api/v1/bookings)', () => {
    test('should manage customer reservations and syncings', async () => {
      // 1. Customer create booking (Public)
      const dateStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post('/api/v1/bookings')
        .send({
          restaurantId: restaurant._id.toString(),
          bookingDate: dateStr,
          timeSlot: '19:30',
          customerName: 'Marcus Aurelius',
          customerEmail: 'marcus@example.com',
          customerMobile: '+919988776655',
          numberOfPeople: 4,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.customerName).toBe('Marcus Aurelius');
      const bookingId = res.body.data._id;

      // 2. Fetch bookings list (Protected)
      const listRes = await request(app)
        .get('/api/v1/bookings')
        .set(ownerHeaders)
        .expect(200);

      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.length).toBe(1);

      // 3. Update booking status (Protected)
      const updateRes = await request(app)
        .patch(`/api/v1/bookings/${bookingId}`)
        .set(ownerHeaders)
        .send({ status: 'confirmed' })
        .expect(200);

      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.status).toBe('confirmed');
    });
  });

  describe('Inventory API (/api/v1/inventory)', () => {
    test('should allow owner to manage raw materials and adjust stock levels', async () => {
      // 1. Create inventory item (Protected)
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .set(ownerHeaders)
        .send({
          name: 'Cheese Slices',
          unit: 'pcs',
          currentStock: 100,
          reorderThreshold: 20,
          costPerUnit: 5,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Cheese Slices');
      const itemId = res.body.data._id;

      // 2. Adjust Stock (Protected)
      const adjustRes = await request(app)
        .post(`/api/v1/inventory/items/${itemId}/adjust`)
        .set(ownerHeaders)
        .send({
          type: 'wastage',
          quantity: 10,
          reason: 'Expired items discarded',
        })
        .expect(200);

      expect(adjustRes.body.success).toBe(true);
      expect(adjustRes.body.data.currentStock).toBe(90);
    });
  });

  describe('Finance API (/api/v1/finance)', () => {
    test('should allow owner to record expenses and generate reports', async () => {
      // 1. Record expense
      const expenseRes = await request(app)
        .post('/api/v1/finance/expenses')
        .set(ownerHeaders)
        .send({
          category: 'utilities',
          amount: 4500,
          description: 'Electricity bill June',
          date: new Date().toISOString(),
        })
        .expect(201);

      expect(expenseRes.body.success).toBe(true);
      expect(expenseRes.body.data.amount).toBe(4500);

      // 2. Get Expenses
      const listRes = await request(app)
        .get('/api/v1/finance/expenses')
        .set(ownerHeaders)
        .expect(200);

      expect(listRes.body.data.length).toBe(1);

      // 3. Generate daily rollup report
      const rollupRes = await request(app)
        .post('/api/v1/finance/reports/pnl/generate')
        .set(ownerHeaders)
        .send({ date: new Date().toISOString() })
        .expect(200);

      expect(rollupRes.body.success).toBe(true);
    });
  });

  describe('Feedback API (/api/v1/feedback)', () => {
    test('should accept public reviews and allow staff management', async () => {
      // 1. Submit feedback (Public)
      const res = await request(app)
        .post('/api/v1/feedback')
        .send({
          restaurantId: restaurant._id.toString(),
          customerName: 'Gordon Ramsay',
          rating: 5,
          comment: 'Outstanding table service and fresh local ingredients!',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const feedbackId = res.body.data._id;

      // 2. Retrieve feedbacks list (Protected)
      const listRes = await request(app)
        .get('/api/v1/feedback')
        .set(ownerHeaders)
        .expect(200);

      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.data[0].customerName).toBe('Gordon Ramsay');

      // 3. Resolve Complaint (mark resolution)
      const complainRes = await request(app)
        .post('/api/v1/feedback')
        .send({
          restaurantId: restaurant._id.toString(),
          customerName: 'Angry Customer',
          rating: 1,
          comment: 'Cold food delivered late!',
          isComplaint: true,
        });

      const complaintId = complainRes.body.data._id;

      const resolveRes = await request(app)
        .patch(`/api/v1/feedback/${complaintId}/resolve`)
        .set(ownerHeaders)
        .send({
          status: 'resolved',
          resolutionNotes: 'Refunded full order amount and offered coupon.',
        })
        .expect(200);

      expect(resolveRes.body.success).toBe(true);
    });
  });

  describe('Screens API & Screen Authentication', () => {
    test('should allow screen registration, listings, and device authentication login', async () => {
      // 1. Create a Screen device config (Protected)
      const createRes = await request(app)
        .post('/api/v1/screens')
        .set(ownerHeaders)
        .send({
          name: 'Main Kitchen KDS',
          screenType: 'kitchen_display',
          username: 'kitchenkds1',
          password: 'secretpassword123',
          assignedRole: 'chef',
          allowedServices: ['water'],
        })
        .expect(201);

      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.username).toBe('kitchenkds1');

      // 2. Authenticate the screen device using screen credentials (Public)
      const loginRes = await request(app)
        .post('/api/v1/auth/login/screen')
        .send({
          restaurantId: restaurant._id.toString(),
          username: 'kitchenkds1',
          password: 'secretpassword123',
        })
        .expect(200);

      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data.tokens.accessToken).toBeTruthy();
      expect(loginRes.body.data.screen.username).toBe('kitchenkds1');
    });
  });
});
