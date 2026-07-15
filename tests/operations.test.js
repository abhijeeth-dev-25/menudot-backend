const request = require('supertest');
const app = require('../src/app');
const {
  setupTestDB,
  cleanupTestDB,
  clearDBCollections,
  registerAndApproveRestaurant,
} = require('./helpers');
const User = require('../src/models/user.model');
const Table = require('../src/models/table.model');
const Order = require('../src/models/order.model');
const RestaurantStaff = require('../src/models/restaurantStaff.model');
const { generateAccessToken } = require('../src/utils/jwt.util');

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await cleanupTestDB();
});

beforeEach(async () => {
  await clearDBCollections();
});

describe('Operations API (Menu, Tables, Staff, Orders)', () => {
  let ownerHeaders;
  let restaurant;

  beforeEach(async () => {
    const setup = await registerAndApproveRestaurant();
    ownerHeaders = setup.headers;
    restaurant = setup.restaurant;
  });

  describe('Staff Management', () => {
    test('should allow owner to create and list staff members', async () => {
      // 1. Create staff member
      const createRes = await request(app)
        .post('/api/v1/staff')
        .set(ownerHeaders)
        .send({
          fullName: 'Chef Bob',
          email: 'bob@chef.com',
          mobile: '+919922334455',
          password: 'password123',
          role: 'chef',
          salary: 25000,
        })
        .expect(201);

      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.role).toBe('chef');
      expect(createRes.body.data.staffId).toBeTruthy();

      // Check user record
      const chefUser = await User.findOne({ email: 'bob@chef.com' });
      expect(chefUser).toBeTruthy();
      expect(chefUser.status).toBe('active');

      // 2. List staff members
      const listRes = await request(app)
        .get('/api/v1/staff')
        .set(ownerHeaders)
        .expect(200);

      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.length).toBe(2); // Owner is also a staff member
    });
  });

  describe('Menu Management', () => {
    test('should allow owner to manage categories and items', async () => {
      // 1. Create Category
      const catRes = await request(app)
        .post('/api/v1/menu/categories')
        .set(ownerHeaders)
        .send({
          name: 'Desserts',
          description: 'Sweet treats',
          sortOrder: 1,
        })
        .expect(201);

      expect(catRes.body.success).toBe(true);
      const categoryId = catRes.body.data._id;

      // 2. List Categories
      const catList = await request(app)
        .get('/api/v1/menu/categories')
        .set(ownerHeaders)
        .expect(200);
      expect(catList.body.data.length).toBe(1);

      // 3. Create Menu Item
      const itemRes = await request(app)
        .post('/api/v1/menu/items')
        .set(ownerHeaders)
        .send({
          categoryId,
          name: 'Chocolate Lava Cake',
          description: 'Warm chocolate cake with molten core',
          price: 150,
          foodType: 'veg',
        })
        .expect(201);

      expect(itemRes.body.success).toBe(true);
      expect(itemRes.body.data.name).toBe('Chocolate Lava Cake');
    });
  });

  describe('Tables & Dine-In QR Ordering Flow', () => {
    test('should execute complete table scanning, order placement, status update, and checkout flow', async () => {
      // 1. Create a table (Protected)
      const tableRes = await request(app)
        .post('/api/v1/tables')
        .set(ownerHeaders)
        .send({
          tableNumber: 'Table 5',
          capacity: 4,
        })
        .expect(201);

      const tableId = tableRes.body.data._id;
      let qrCodeStr = tableRes.body.data.qrCode.code;

      // 2. Toggle QR Scan permission on (Protected)
      await request(app)
        .patch(`/api/v1/tables/${tableId}/qr/toggle`)
        .set(ownerHeaders)
        .send({ isActive: true })
        .expect(200);

      // 3. Create a Category and Menu Item for order
      const catRes = await request(app)
        .post('/api/v1/menu/categories')
        .set(ownerHeaders)
        .send({ name: 'Burgers' });

      const itemRes = await request(app)
        .post('/api/v1/menu/items')
        .set(ownerHeaders)
        .send({
          categoryId: catRes.body.data._id,
          name: 'Cheese Burger',
          price: 120,
          foodType: 'veg',
        });

      const itemId = itemRes.body.data._id;

      // 4. Customer scan QR code (Public)
      const scanRes = await request(app)
        .post('/api/v1/tables/scan')
        .send({
          code: qrCodeStr,
          customerName: 'Customer John',
          numberOfPeople: 2,
          deviceId: 'johns_phone_uuid_123',
        })
        .expect(200);

      expect(scanRes.body.success).toBe(true);

      // Verify table status is now occupied
      const occupiedTable = await Table.findById(tableId);
      expect(occupiedTable.status).toBe('occupied');
      expect(occupiedTable.activeSession.customerName).toBe('Customer John');

      // 5. Place order via QR code (Public)
      const orderRes = await request(app)
        .post('/api/v1/tables/order')
        .send({
          code: qrCodeStr,
          deviceId: 'johns_phone_uuid_123',
          items: [
            {
              itemId,
              quantity: 2,
            },
          ],
        })
        .expect(201);

      expect(orderRes.body.success).toBe(true);
      const orderId = orderRes.body.data._id;
      expect(orderRes.body.data.items[0].name).toBe('Cheese Burger');
      expect(orderRes.body.data.payment.status).toBe('pending');

      // 6. Update order status to preparing (Protected - Chef role)
      // First, create a Chef staff member to update the status
      const chefUser = new User({
        fullName: 'Chef Bob',
        email: 'bob@chef.com',
        mobile: '+919922334455',
        passwordHash: 'pass123',
        status: 'active',
      });
      await chefUser.save();

      const chefStaff = new RestaurantStaff({
        restaurantId: restaurant._id,
        userId: chefUser._id,
        role: 'chef',
        status: 'active',
      });
      await chefStaff.save();

      const chefToken = generateAccessToken(chefUser, 'user');
      const chefHeaders = {
        Authorization: `Bearer ${chefToken}`,
        'x-restaurant-id': restaurant._id.toString(),
      };

      const statusRes = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set(chefHeaders)
        .send({ status: 'preparing' })
        .expect(200);

      expect(statusRes.body.success).toBe(true);
      expect(statusRes.body.data.status).toBe('preparing');

      // 7. Checkout the table (Protected - Owner/Manager role)
      const checkoutRes = await request(app)
        .post(`/api/v1/tables/${tableId}/checkout`)
        .set(ownerHeaders)
        .expect(200);

      expect(checkoutRes.body.success).toBe(true);

      // Verify table is vacant and session is cleared
      const vacantTable = await Table.findById(tableId);
      expect(vacantTable.status).toBe('vacant');
      expect(vacantTable.activeSession).toBeNull();
    });
  });
});
