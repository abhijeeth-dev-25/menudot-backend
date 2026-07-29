const request = require('supertest');
const app = require('../src/app');
const Table = require('../src/models/table.model');
const MenuCategory = require('../src/models/menuCategory.model');
const MenuItem = require('../src/models/menuItem.model');
const {
  setupTestDB,
  cleanupTestDB,
  registerAndApproveRestaurant,
} = require('./helpers');

describe('Order & Notification API Integration Tests', () => {
  let restaurant;
  let ownerToken;
  let restaurantHeaders;
  let table;
  let category;
  let menuItem;

  const deviceId = 'test_device_12345';
  const customerName = 'John Doe';

  beforeAll(async () => {
    await setupTestDB();

    // 1. Register & approve test restaurant
    const setup = await registerAndApproveRestaurant();
    restaurant = setup.restaurant;
    ownerToken = setup.token;
    restaurantHeaders = setup.headers;

    // 2. Create Table
    table = new Table({
      restaurantId: restaurant._id,
      tableNumber: 'T-10',
      capacity: 4,
      qrCode: {
        code: 'test_qr_code_t10',
        isActive: false, // Initially inactive
      },
    });
    await table.save();

    // 3. Create Menu Category & Menu Item
    category = new MenuCategory({
      restaurantId: restaurant._id,
      name: 'Starters',
      slug: 'starters',
      sortOrder: 1,
      status: 'active',
    });
    await category.save();

    menuItem = new MenuItem({
      restaurantId: restaurant._id,
      categoryId: category._id,
      name: 'Paneer Butter Masala',
      foodType: 'veg',
      price: 250,
      taxRate: 5,
      status: 'available',
      addOnGroups: [
        {
          name: 'Choice of Bread',
          minSelect: 0,
          maxSelect: 2,
          options: [{ name: 'Butter Naan', price: 40 }],
        },
      ],
    });
    await menuItem.save();
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  // ==========================================
  // 1. TABLE QR SCAN & ACCESS UNLOCK FLOW
  // ==========================================
  describe('Table QR Scan & Access Unlock Workflow', () => {
    it('1.1 Should return 403 when customer scans inactive table QR code', async () => {
      const res = await request(app)
        .post('/api/v1/tables/scan')
        .send({
          code: table.qrCode.code,
          customerName,
          numberOfPeople: 2,
          deviceId,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('locked');

      // Verify pending unlock request recorded on table
      const updatedTable = await Table.findById(table._id);
      expect(updatedTable.qrUnlockRequest.requested).toBe(true);
      expect(updatedTable.qrUnlockRequest.customerName).toBe(customerName);
    });

    it('1.2 Should allow staff to fetch pending unlock requests', async () => {
      const res = await request(app)
        .get('/api/v1/tables/staff/pending-unlock-requests')
        .set(restaurantHeaders);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('1.3 Should allow staff to unlock table QR code access', async () => {
      const res = await request(app)
        .post(`/api/v1/tables/${table._id}/unlock-access`)
        .set(restaurantHeaders)
        .send({
          customerName,
          numberOfPeople: 2,
          deviceId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.qrCode.isActive).toBe(true);
      expect(res.body.data.status).toBe('occupied');
    });

    it('1.4 Should return catalog and active session when scanning unlocked table QR code', async () => {
      const res = await request(app)
        .post('/api/v1/tables/scan')
        .send({
          code: table.qrCode.code,
          customerName,
          numberOfPeople: 2,
          deviceId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.table.tableNumber).toBe('T-10');
      expect(res.body.data.menu).toBeDefined();
    });
  });

  // ==========================================
  // 2. DINE-IN ORDER PLACEMENT & TRACKING
  // ==========================================
  describe('Dine-In Order Placement & Status Tracking', () => {
    let placedOrder;

    it('2.1 Should place dine-in order via table QR code', async () => {
      const res = await request(app)
        .post('/api/v1/tables/order')
        .send({
          code: table.qrCode.code,
          deviceId,
          items: [
            {
              itemId: menuItem._id.toString(),
              quantity: 2,
              addOns: [{ name: 'Butter Naan', price: 40 }],
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      placedOrder = res.body.data;
      expect(placedOrder._id).toBeDefined();
      expect(placedOrder.deviceId).toBe(deviceId);
      expect(placedOrder.status).toBe('received');
      expect(placedOrder.items.length).toBe(1);
    });

    it('2.2 Should fetch customer order details by orderId without require path error', async () => {
      const res = await request(app).get(`/api/v1/tables/order/${placedOrder._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(placedOrder._id);
      expect(res.body.data.tableNumber).toBe('T-10');
    });

    it('2.3 Should get order tracking status by orderId', async () => {
      const res = await request(app)
        .get('/api/v1/customer/status')
        .set('x-restaurant-id', restaurant._id.toString())
        .query({ orderId: placedOrder._id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.activeOrder).toBeDefined();
      expect(res.body.data.activeOrder.id).toBe(placedOrder._id);
      expect(res.body.data.progress.steps.length).toBe(4);
    });

    it('2.4 Should get order tracking status by deviceId', async () => {
      const res = await request(app)
        .get('/api/v1/customer/status')
        .set('x-restaurant-id', restaurant._id.toString())
        .set('x-device-id', deviceId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.activeOrder).toBeDefined();
      expect(res.body.data.activeOrder.id).toBe(placedOrder._id);
    });

    it('2.5 Should get customer order history by deviceId', async () => {
      const res = await request(app)
        .get('/api/v1/customer/orders/history')
        .set('x-restaurant-id', restaurant._id.toString())
        .set('x-device-id', deviceId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].id).toBe(placedOrder._id);
    });

    it('2.6 Should get bill summary for table', async () => {
      const res = await request(app)
        .get('/api/v1/customer/bill')
        .set('x-restaurant-id', restaurant._id.toString())
        .query({ tableId: table._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderCount).toBe(1);
      expect(res.body.data.totalPayable).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // 3. TABLE SERVICE CALLS & WAITER NOTIFICATIONS
  // ==========================================
  describe('Table Service Calls & Waiter Alerts', () => {
    it('3.1 Should trigger public service call via /api/v1/tables/call', async () => {
      const res = await request(app)
        .post('/api/v1/tables/call')
        .send({
          restaurantId: restaurant._id.toString(),
          tableNumber: 'T-10',
          serviceType: 'water',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('3.2 Should request table service via /api/v1/customer/service-request and generate notification', async () => {
      const res = await request(app)
        .post('/api/v1/customer/service-request')
        .set('x-restaurant-id', restaurant._id.toString())
        .send({
          tableId: table._id.toString(),
          serviceType: 'bill',
          note: 'Please bring card machine',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // 4. RESTAURANT STAFF ORDER MANAGEMENT & NOTIFICATIONS
  // ==========================================
  describe('Restaurant Staff Order Management & Notifications', () => {
    let targetOrderId;

    it('4.1 Should list orders in restaurant queue', async () => {
      const res = await request(app)
        .get('/api/v1/orders')
        .set(restaurantHeaders);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      targetOrderId = res.body.data[0]._id;
    });

    it('4.2 Should update order preparation status to preparing', async () => {
      const res = await request(app)
        .patch(`/api/v1/orders/${targetOrderId}/status`)
        .set(restaurantHeaders)
        .send({ status: 'preparing' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('preparing');
    });

    it('4.3 Should update order status to completed', async () => {
      const res = await request(app)
        .patch(`/api/v1/orders/${targetOrderId}/status`)
        .set(restaurantHeaders)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
    });

    it('4.4 Should fetch restaurant notifications inbox', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set(restaurantHeaders);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('4.5 Should fetch notification unread count', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set(restaurantHeaders);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.unreadCount).toBe('number');
    });

    it('4.6 Should mark all notifications as read', async () => {
      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set(restaurantHeaders);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('4.7 Should clear all active notifications', async () => {
      const res = await request(app)
        .delete('/api/v1/notifications')
        .set(restaurantHeaders);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // 5. TABLE CHECKOUT FLOW
  // ==========================================
  describe('Table Checkout Workflow', () => {
    it('5.1 Should checkout table and clear active session', async () => {
      const res = await request(app)
        .post(`/api/v1/tables/${table._id}/checkout`)
        .set(restaurantHeaders);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('vacant');
      expect(res.body.data.activeSession).toBeNull();
    });
  });
});
