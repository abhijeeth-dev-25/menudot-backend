const request = require('supertest');
const {
  setupTestDB,
  cleanupTestDB,
  clearDBCollections,
  createPlatformAdmin,
  registerAndApproveRestaurant,
} = require('./helpers');
const app = require('../src/app');
const Table = require('../src/models/table.model');
const Order = require('../src/models/order.model');
const MenuItem = require('../src/models/menuItem.model');
const Bill = require('../src/models/bill.model');

describe('Bill History, Thermal Print & Offline Settlement API', () => {
  let adminData;
  let tenantData;
  let authHeaders;
  let restaurantId;
  let testTable;
  let testMenuItem;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  beforeEach(async () => {
    await clearDBCollections();
    adminData = await createPlatformAdmin();
    tenantData = await registerAndApproveRestaurant(adminData.token);
    authHeaders = tenantData.headers;
    restaurantId = tenantData.restaurant._id.toString();

    const MenuCategory = require('../src/models/menuCategory.model');
    const category = new MenuCategory({
      restaurantId,
      name: 'Main Course',
      slug: 'main-course',
    });
    await category.save();

    testMenuItem = new MenuItem({
      restaurantId,
      categoryId: category._id,
      name: 'Paneer Butter Masala',
      price: 320,
      foodType: 'veg',
      status: 'available',
      isVegetarian: true,
    });
    await testMenuItem.save();

    // Create test table
    testTable = new Table({
      restaurantId,
      tableNumber: '1',
      capacity: 4,
      status: 'occupied',
      activeSession: {
        customerName: 'Rahul Sharma',
        numberOfPeople: 3,
        deviceId: 'dev-device-123',
        scannedAt: new Date(),
        orderIds: [],
      },
    });
    await testTable.save();
  });

  test('1. Generate Bill for Table with Dynamic Payment QR Code', async () => {
    // Create an active dine-in order for Table 1
    const order = new Order({
      restaurantId,
      orderSource: 'dine_in',
      tableId: testTable._id,
      tableNumber: '1',
      deviceId: 'dev-device-123',
      numberOfPeople: 3,
      customer: { name: 'Rahul Sharma', mobile: '9876543210' },
      items: [
        {
          itemId: testMenuItem._id,
          name: testMenuItem.name,
          price: testMenuItem.price,
          quantity: 2,
          addOns: [],
        },
      ],
      status: 'preparing',
      totals: {
        subtotal: 640,
        tax: 32,
        platformCharge: 0,
        discount: 0,
        grandTotal: 672,
      },
    });
    await order.save();

    const res = await request(app)
      .post(`/api/v1/bills/table/${testTable._id}/generate`)
      .set(authHeaders)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('invoiceNumber');
    expect(res.body.data.tableNumber).toBe('1');
    expect(res.body.data.numberOfPeople).toBe(3);
    expect(res.body.data.paymentStatus).toBe('unpaid');
    expect(res.body.data.totals.grandTotal).toBe(672);
    expect(res.body.data.upiPaymentQrUrl).toMatch(/^data:image\/png;base64,/);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe('Paneer Butter Masala');
  });

  test('2. Settle Bill using Offline Cash Payment & Verify Table Checkout', async () => {
    // Generate bill first
    const order = new Order({
      restaurantId,
      orderSource: 'dine_in',
      tableId: testTable._id,
      tableNumber: '1',
      numberOfPeople: 3,
      items: [
        {
          itemId: testMenuItem._id,
          name: testMenuItem.name,
          price: testMenuItem.price,
          quantity: 1,
        },
      ],
      status: 'preparing',
      totals: { subtotal: 320, tax: 16, grandTotal: 336 },
    });
    await order.save();

    const genRes = await request(app)
      .post(`/api/v1/bills/table/${testTable._id}/generate`)
      .set(authHeaders);
    const billId = genRes.body.data._id;

    // Settle bill via offline cash
    const settleRes = await request(app)
      .post(`/api/v1/bills/${billId}/settle`)
      .set(authHeaders)
      .send({
        payments: [
          {
            amount: 336,
            method: 'cash',
            transactionRef: 'CASH-REC-101',
          },
        ],
        customer: { name: 'Rahul Sharma', mobile: '9876543210' },
      });

    expect(settleRes.status).toBe(200);
    expect(settleRes.body.success).toBe(true);
    expect(settleRes.body.data.paymentStatus).toBe('paid');
    expect(settleRes.body.data.paymentChannel).toBe('offline');

    // Verify order status updated to 'completed'
    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.status).toBe('completed');
    expect(updatedOrder.payment.status).toBe('paid');

    // Verify table checked out to 'vacant'
    const updatedTable = await Table.findById(testTable._id);
    expect(updatedTable.status).toBe('vacant');
    expect(updatedTable.activeSession).toBeNull();
  });

  test('3. Retrieve Thermal Printable Receipt (HTML Format)', async () => {
    const order = new Order({
      restaurantId,
      orderSource: 'dine_in',
      tableId: testTable._id,
      tableNumber: '1',
      items: [{ itemId: testMenuItem._id, name: testMenuItem.name, price: 320, quantity: 1 }],
      totals: { subtotal: 320, tax: 16, grandTotal: 336 },
    });
    await order.save();

    const genRes = await request(app)
      .post(`/api/v1/bills/table/${testTable._id}/generate`)
      .set(authHeaders);
    const billId = genRes.body.data._id;

    const printRes = await request(app)
      .get(`/api/v1/bills/${billId}/print?format=html`)
      .set(authHeaders);

    expect(printRes.status).toBe(200);
    expect(printRes.headers['content-type']).toMatch(/text\/html/);
    expect(printRes.text).toContain('Paneer Butter Masala');
    expect(printRes.text).toContain('Grand Total');
  });

  test('4. Live Bills Stream & Daily Settlement Summary', async () => {
    const order = new Order({
      restaurantId,
      orderSource: 'dine_in',
      tableId: testTable._id,
      tableNumber: '1',
      items: [{ itemId: testMenuItem._id, name: testMenuItem.name, price: 320, quantity: 1 }],
      totals: { subtotal: 320, tax: 16, grandTotal: 336 },
    });
    await order.save();

    await request(app)
      .post(`/api/v1/bills/table/${testTable._id}/generate`)
      .set(authHeaders);

    const liveRes = await request(app)
      .get('/api/v1/bills/live')
      .set(authHeaders);

    expect(liveRes.status).toBe(200);
    expect(liveRes.body.success).toBe(true);
    expect(liveRes.body.data.liveBills).toHaveLength(1);
    expect(liveRes.body.data).toHaveProperty('dailySummary');
  });

  test('5. Historical Bill Search with Filters', async () => {
    const order = new Order({
      restaurantId,
      orderSource: 'dine_in',
      tableId: testTable._id,
      tableNumber: '1',
      items: [{ itemId: testMenuItem._id, name: testMenuItem.name, price: 320, quantity: 1 }],
      totals: { subtotal: 320, tax: 16, grandTotal: 336 },
    });
    await order.save();

    const genRes = await request(app)
      .post(`/api/v1/bills/table/${testTable._id}/generate`)
      .set(authHeaders);
    const billId = genRes.body.data._id;

    await request(app)
      .post(`/api/v1/bills/${billId}/settle`)
      .set(authHeaders)
      .send({ payments: [{ amount: 336, method: 'cash' }] });

    const historyRes = await request(app)
      .get('/api/v1/bills/history?paymentStatus=paid&paymentChannel=offline&tableNumber=1')
      .set(authHeaders);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.success).toBe(true);
    expect(historyRes.body.data.bills).toHaveLength(1);
    expect(historyRes.body.data.bills[0].tableNumber).toBe('1');
    expect(historyRes.body.data.bills[0].paymentStatus).toBe('paid');
  });
});
