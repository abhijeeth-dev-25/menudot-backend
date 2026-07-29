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

describe('Frontend-Backend Order & Notification Connection Integration Tests', () => {
  let restaurant;
  let ownerToken;
  let restaurantHeaders;
  let table;
  let category;
  let menuItem;

  const deviceId = 'frontend_device_9988';
  const tableCode = 'qr_table_code_frontend_test';
  const customerName = 'Alice Smith';

  beforeAll(async () => {
    await setupTestDB();

    // 1. Register & approve test restaurant
    const setup = await registerAndApproveRestaurant();
    restaurant = setup.restaurant;
    ownerToken = setup.token;
    restaurantHeaders = setup.headers;

    // 2. Create Active Table with specific QR Code
    table = new Table({
      restaurantId: restaurant._id,
      tableNumber: 'T-05',
      capacity: 4,
      status: 'occupied',
      qrCode: {
        code: tableCode,
        isActive: true,
      },
      activeSession: {
        customerName,
        numberOfPeople: 2,
        deviceId,
        scannedAt: new Date(),
        orderIds: [],
      },
    });
    await table.save();

    // 3. Create Menu Category & Menu Item
    category = new MenuCategory({
      restaurantId: restaurant._id,
      name: 'Main Course',
      slug: 'main-course',
      sortOrder: 1,
      status: 'active',
    });
    await category.save();

    menuItem = new MenuItem({
      restaurantId: restaurant._id,
      categoryId: category._id,
      name: 'Chicken Tikka Masala',
      foodType: 'non-veg',
      price: 320,
      taxRate: 5,
      status: 'available',
      addOnGroups: [
        {
          name: 'Extra Gravy',
          minSelect: 0,
          maxSelect: 1,
          options: [{ name: 'Spicy Gravy', price: 50 }],
        },
      ],
    });
    await menuItem.save();
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  // ==========================================
  // 1. ORDER PLACEMENT VIA REAL BACKEND API
  // ==========================================
  it('1.1 Should place real order into database via POST /api/v1/tables/order using tableCode', async () => {
    const res = await request(app)
      .post('/api/v1/tables/order')
      .send({
        code: tableCode,
        deviceId,
        items: [
          {
            itemId: menuItem._id.toString(),
            quantity: 2,
            addOns: [{ name: 'Spicy Gravy', price: 50 }],
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const order = res.body.data;

    expect(order._id).toBeDefined();
    expect(order.orderSource).toBe('dine_in');
    expect(order.deviceId).toBe(deviceId);
    expect(order.tableNumber).toBe('T-05');
    expect(order.status).toBe('received');
    expect(order.totals.grandTotal).toBeGreaterThan(0);
  });

  // ==========================================
  // 2. BILL SUMMARY RETRIEVAL VIA TABLECODE
  // ==========================================
  it('2.1 Should retrieve live bill summary via GET /api/v1/customer/bill using tableCode query param', async () => {
    const res = await request(app)
      .get('/api/v1/customer/bill')
      .set('x-restaurant-id', restaurant._id.toString())
      .query({ tableCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderCount).toBe(1);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].name).toBe('Chicken Tikka Masala');
  });

  // ==========================================
  // 3. SERVICE REQUEST VIA TABLECODE
  // ==========================================
  it('3.1 Should accept service call using tableCode via POST /api/v1/customer/service-request', async () => {
    const res = await request(app)
      .post('/api/v1/customer/service-request')
      .set('x-restaurant-id', restaurant._id.toString())
      .send({
        tableCode,
        serviceType: 'water',
        notes: 'Cold water please',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Staff alerted');
  });

  // ==========================================
  // 4. STAFF ORDER QUEUE & STATUS UPDATES
  // ==========================================
  it('4.1 Staff should view placed order in restaurant queue via GET /api/v1/orders', async () => {
    const res = await request(app)
      .get('/api/v1/orders')
      .set(restaurantHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].tableNumber).toBe('T-05');
  });

  it('4.2 Staff should update order status to preparing via PATCH /api/v1/orders/:orderId/status', async () => {
    // First get orderId
    const ordersRes = await request(app)
      .get('/api/v1/orders')
      .set(restaurantHeaders);
    const orderId = ordersRes.body.data[0]._id;

    const res = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set(restaurantHeaders)
      .send({ status: 'preparing' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('preparing');
  });

  // ==========================================
  // 5. STAFF NOTIFICATIONS VERIFICATION
  // ==========================================
  it('5.1 Staff should receive order and service notifications via GET /api/v1/notifications', async () => {
    // Wait 100ms for async queue worker execution
    await new Promise((r) => setTimeout(r, 100));

    const res = await request(app)
      .get('/api/v1/notifications')
      .set(restaurantHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });
});
