const request = require('supertest');
const app = require('../src/app');
const {
  setupTestDB,
  cleanupTestDB,
  clearDBCollections,
  createPlatformAdmin,
  registerAndApproveRestaurant,
} = require('./helpers');
const ExperienceService = require('../src/models/experienceService.model');
const HeroBanner = require('../src/models/heroBanner.model');
const MenuCategory = require('../src/models/menuCategory.model');
const MenuItem = require('../src/models/menuItem.model');
const Table = require('../src/models/table.model');
const Order = require('../src/models/order.model');

describe('Customer Portal & Ad Engine Comprehensive Test Suite', () => {
  let restaurant;
  let restaurantHeaders;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  beforeEach(async () => {
    await clearDBCollections();
    const admin = await createPlatformAdmin();
    const setup = await registerAndApproveRestaurant(admin.token);
    restaurant = setup.restaurant;
    restaurantHeaders = setup.headers;
  });

  // =========================================================================
  // 1. HOME FEED & BRANCHES TESTS
  // =========================================================================
  describe('GET /api/v1/customer/home-feed', () => {
    it('returns aggregated home page feed payload with experiences, banners, and categories', async () => {
      await ExperienceService.create({
        restaurantId: restaurant._id,
        title: 'Buffet Feast',
        category: 'buffet',
        tagline: 'Unlimited 45+ dishes',
        priceStartingFrom: 699,
        isAvailable: true,
      });

      await HeroBanner.create({
        restaurantId: restaurant._id,
        title: 'Weekend Special Offer',
        imageUrl: 'https://example.com/banner.jpg',
        badgeText: '20% OFF',
        isActive: true,
      });

      const category = await MenuCategory.create({
        restaurantId: restaurant._id,
        name: 'Starters',
        slug: 'starters',
        status: 'active',
      });

      await MenuItem.create({
        restaurantId: restaurant._id,
        categoryId: category._id,
        name: 'Paneer Tikka',
        price: 280,
        foodType: 'veg',
        status: 'available',
      });

      const res = await request(app)
        .get('/api/v1/customer/home-feed')
        .set('x-restaurant-id', restaurant._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.restaurant.name).toContain('Test Restaurant');
      expect(res.body.data.heroBanners).toHaveLength(1);
      expect(res.body.data.experienceServices).toHaveLength(1);
      expect(res.body.data.featuredCategories).toHaveLength(1);
    });

    it('handles table QR session status check when tableCode parameter is passed', async () => {
      const table = await Table.create({
        restaurantId: restaurant._id,
        tableNumber: 'T-01',
        capacity: 4,
        status: 'occupied',
        qrCode: { code: 'qr_test_code_123', isActive: true },
      });

      const res = await request(app)
        .get(`/api/v1/customer/home-feed?tableCode=${table.qrCode.code}`)
        .set('x-restaurant-id', restaurant._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.data.sessionStatus.isUnlocked).toBe(true);
      expect(res.body.data.sessionStatus.tableNumber).toBe('T-01');
    });

    it('returns 400 Bad Request when x-restaurant-id is missing', async () => {
      const res = await request(app).get('/api/v1/customer/home-feed');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/customer/branches', () => {
    it('returns empty branches list by default and allows merchant to update branches', async () => {
      const getRes = await request(app)
        .get('/api/v1/customer/branches')
        .set('x-restaurant-id', restaurant._id.toString());

      expect(getRes.status).toBe(200);
      expect(getRes.body.data).toEqual([]);

      // Update branches via merchant endpoint
      const updateRes = await request(app)
        .put('/api/v1/restaurant/experiences/branches')
        .set(restaurantHeaders)
        .send({
          branches: [
            {
              name: 'Jubilee Hills Outlet',
              address: 'Road No 36, Jubilee Hills',
              city: 'Hyderabad',
              mobile: '+919988776655',
              isMainBranch: true,
            },
          ],
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data).toHaveLength(1);
      expect(updateRes.body.data[0].name).toBe('Jubilee Hills Outlet');
    });
  });

  // =========================================================================
  // 2. MENU CATALOG, SEARCH & ITEM DETAILS TESTS
  // =========================================================================
  describe('GET /api/v1/customer/menu & /search', () => {
    let category;
    let item1;
    let item2;

    beforeEach(async () => {
      category = await MenuCategory.create({
        restaurantId: restaurant._id,
        name: 'Main Course',
        slug: 'main-course',
        status: 'active',
      });

      item1 = await MenuItem.create({
        restaurantId: restaurant._id,
        categoryId: category._id,
        name: 'Paneer Butter Masala',
        description: 'Rich tomato gravy with cottage cheese',
        price: 320,
        foodType: 'veg',
        status: 'available',
        ratingsSummary: { overallRating: 4.9, totalReviews: 25 },
      });

      item2 = await MenuItem.create({
        restaurantId: restaurant._id,
        categoryId: category._id,
        name: 'Chicken Chettinad',
        description: 'Spicy South Indian chicken curry',
        price: 380,
        foodType: 'non-veg',
        status: 'available',
        ratingsSummary: { overallRating: 4.5, totalReviews: 10 },
      });
    });

    it('returns grouped menu catalog', async () => {
      const res = await request(app)
        .get('/api/v1/customer/menu')
        .set('x-restaurant-id', restaurant._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.data.categories).toHaveLength(1);
      expect(res.body.data.categories[0].items).toHaveLength(2);
    });

    it('searches menu items by text query', async () => {
      const res = await request(app)
        .get('/api/v1/customer/menu/search?q=Paneer')
        .set('x-restaurant-id', restaurant._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].name).toBe('Paneer Butter Masala');
    });

    it('filters menu items by dietary type (veg)', async () => {
      const res = await request(app)
        .get('/api/v1/customer/menu/search?foodType=veg')
        .set('x-restaurant-id', restaurant._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].foodType).toBe('veg');
    });

    it('sorts menu items by price_asc, price_desc, and rating', async () => {
      const ascRes = await request(app)
        .get('/api/v1/customer/menu/search?sortBy=price_asc')
        .set('x-restaurant-id', restaurant._id.toString());

      expect(ascRes.status).toBe(200);
      expect(ascRes.body.data.items[0].price).toBe(320);

      const descRes = await request(app)
        .get('/api/v1/customer/menu/search?sortBy=price_desc')
        .set('x-restaurant-id', restaurant._id.toString());

      expect(descRes.status).toBe(200);
      expect(descRes.body.data.items[0].price).toBe(380);
    });

    it('fetches single item details by itemId', async () => {
      const res = await request(app)
        .get(`/api/v1/customer/menu/items/${item1._id}`)
        .set('x-restaurant-id', restaurant._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Paneer Butter Masala');
    });

    it('returns 404 for non-existent item id', async () => {
      const res = await request(app)
        .get('/api/v1/customer/menu/items/66a1bf000000000000000000')
        .set('x-restaurant-id', restaurant._id.toString());

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // 3. ACCOUNT, SWIGGY LINK, HISTORY & BILL TESTS
  // =========================================================================
  describe('Account & Swiggy Link Endpoints', () => {
    it('links Swiggy partner account and checks link status', async () => {
      const deviceId = 'dev_swiggy_123';

      const linkRes = await request(app)
        .post('/api/v1/customer/swiggy/link')
        .set('x-restaurant-id', restaurant._id.toString())
        .set('x-device-id', deviceId)
        .send({
          deviceId,
          swiggyUserId: 'swiggy_user_777',
          swiggyMobile: '+919900112233',
        });

      expect(linkRes.status).toBe(200);
      expect(linkRes.body.data.isLinked).toBe(true);
      expect(linkRes.body.data.partnerOffers).toHaveLength(2);

      // Check status
      const statusRes = await request(app)
        .get('/api/v1/customer/swiggy/status')
        .set('x-restaurant-id', restaurant._id.toString())
        .set('x-device-id', deviceId);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.isLinked).toBe(true);
    });

    it('validates request payload when linking Swiggy account', async () => {
      const res = await request(app)
        .post('/api/v1/customer/swiggy/link')
        .set('x-restaurant-id', restaurant._id.toString())
        .send({
          deviceId: 'dev_123',
          // missing swiggyUserId
        });

      expect(res.status).toBe(400);
    });

    it('calculates active bill summary for a device', async () => {
      const deviceId = 'device_bill_test';
      const category = await MenuCategory.create({
        restaurantId: restaurant._id,
        name: 'Sides',
        slug: 'sides',
      });
      const item = await MenuItem.create({
        restaurantId: restaurant._id,
        categoryId: category._id,
        name: 'Butter Naan',
        price: 50,
        foodType: 'veg',
      });

      await Order.create({
        orderSource: 'dine_in',
        platformOrderId: 'ORD_101',
        restaurantId: restaurant._id,
        deviceId,
        status: 'completed',
        items: [{ itemId: item._id, name: 'Butter Naan', price: 50, quantity: 2 }],
        totals: {
          subtotal: 100,
          tax: 5,
          packingCharges: 0,
          discount: 0,
          grandTotal: 105,
        },
      });

      const billRes = await request(app)
        .get(`/api/v1/customer/bill?deviceId=${deviceId}`)
        .set('x-restaurant-id', restaurant._id.toString());

      expect(billRes.status).toBe(200);
      expect(billRes.body.data.subtotal).toBe(100);
      expect(billRes.body.data.tax).toBe(5);
      expect(billRes.body.data.totalPayable).toBe(105);
    });
  });

  // =========================================================================
  // 4. ORDER STATUS & SERVICE CALLS TESTS
  // =========================================================================
  describe('Order Status & Table Service Calls', () => {
    it('returns active order tracking status and progress steps', async () => {
      const category = await MenuCategory.create({
        restaurantId: restaurant._id,
        name: 'Biryanis',
        slug: 'biryanis',
      });
      const item = await MenuItem.create({
        restaurantId: restaurant._id,
        categoryId: category._id,
        name: 'Veg Biryani',
        price: 250,
        foodType: 'veg',
      });

      const order = await Order.create({
        orderSource: 'dine_in',
        platformOrderId: 'ORD_TRACK_1',
        restaurantId: restaurant._id,
        deviceId: 'dev_track_1',
        status: 'preparing',
        items: [{ itemId: item._id, name: 'Veg Biryani', price: 250, quantity: 1 }],
        totals: {
          subtotal: 250,
          tax: 12.5,
          grandTotal: 262.5,
        },
      });

      const res = await request(app)
        .get(`/api/v1/customer/status?orderId=${order._id}`)
        .set('x-restaurant-id', restaurant._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.data.activeOrder.orderNumber).toBe('ORD_TRACK_1');
      expect(res.body.data.progress.currentStep).toBe('preparing');
      expect(res.body.data.progress.steps[1].isCompleted).toBe(true);
    });

    it('rejects table service call if table is not active / unlocked', async () => {
      const table = await Table.create({
        restaurantId: restaurant._id,
        tableNumber: 'T-09',
        capacity: 2,
        status: 'vacant',
        qrCode: { code: 'qr_locked_99', isActive: false },
      });

      const res = await request(app)
        .post('/api/v1/customer/service-request')
        .set('x-restaurant-id', restaurant._id.toString())
        .send({
          tableId: table._id,
          serviceType: 'water',
        });

      expect(res.status).toBe(403);
    });

    it('dispatches table service request when table session is active', async () => {
      const table = await Table.create({
        restaurantId: restaurant._id,
        tableNumber: 'T-09',
        capacity: 2,
        status: 'occupied',
        qrCode: { code: 'qr_unlocked_99', isActive: true },
      });

      const res = await request(app)
        .post('/api/v1/customer/service-request')
        .set('x-restaurant-id', restaurant._id.toString())
        .send({
          tableId: table._id,
          serviceType: 'water',
          note: 'Please bring warm water',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // 5. MERCHANT CRUD & AD ENGINE TESTS
  // =========================================================================
  describe('Merchant Experience Services & Banners CRUD', () => {
    it('allows merchant owner to create, update, and soft delete hero banners', async () => {
      // Create
      const createRes = await request(app)
        .post('/api/v1/restaurant/experiences/hero-banners')
        .set(restaurantHeaders)
        .send({
          title: 'Monsoon Special',
          imageUrl: 'https://example.com/monsoon.jpg',
          badgeText: 'HOT DEAL',
          isActive: true,
        });

      expect(createRes.status).toBe(201);
      const bannerId = createRes.body.data._id;

      // List
      const listRes = await request(app)
        .get('/api/v1/restaurant/experiences/hero-banners')
        .set(restaurantHeaders);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);

      // Update
      const updateRes = await request(app)
        .patch(`/api/v1/restaurant/experiences/hero-banners/${bannerId}`)
        .set(restaurantHeaders)
        .send({ title: 'Monsoon Super Saver' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Monsoon Super Saver');

      // Delete
      const deleteRes = await request(app)
        .delete(`/api/v1/restaurant/experiences/hero-banners/${bannerId}`)
        .set(restaurantHeaders);

      expect(deleteRes.status).toBe(200);
    });
  });

  describe('GET /api/v1/customer/ads across placement zones', () => {
    it('serves placement ads for all 5 defined UI placement zones', async () => {
      const placements = [
        'home_top_banner',
        'home_in_feed',
        'navbar_bottom_sticky',
        'payment_checkout_banner',
        'order_status_card',
      ];

      for (const placementKey of placements) {
        const res = await request(app)
          .get(`/api/v1/customer/ads?placementKey=${placementKey}`)
          .set('x-restaurant-id', restaurant._id.toString());

        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.data[0].placementKey).toBe(placementKey);
      }
    });
  });
});
