const request = require('supertest');
const app = require('../src/app');
const {
  setupTestDB,
  cleanupTestDB,
  clearDBCollections,
} = require('./helpers');
const User = require('../src/models/user.model');
const Restaurant = require('../src/models/restaurant.model');
const MenuItem = require('../src/models/menuItem.model');
const MenuCategory = require('../src/models/menuCategory.model');
const Table = require('../src/models/table.model');
const Order = require('../src/models/order.model');
const Coupon = require('../src/models/coupon.model');
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

// Helper to create platform or restaurant users
async function createAuthContext(role, scope = 'platform', restaurantId = null) {
  const user = new User({
    fullName: `Auth ${role}`,
    email: `${role}_${Math.floor(Math.random() * 1000)}@test.com`,
    mobile: `+919999000${Math.floor(Math.random() * 900 + 100)}`,
    passwordHash: 'password123',
    globalRole: scope === 'platform' ? role : 'restaurant_user',
    status: 'active',
  });
  await user.save();

  const token = generateAccessToken(user, 'user');
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  if (restaurantId) {
    headers['x-restaurant-id'] = restaurantId.toString();

    // Map staff membership
    const staff = new RestaurantStaff({
      restaurantId,
      userId: user._id,
      role: role, // 'owner', 'manager', etc.
      status: 'active',
    });
    await staff.save();
  }

  return { user, token, headers };
}

async function setupRestaurantAndMenu() {
  const ownerContext = await createAuthContext('owner', 'restaurant');
  
  const restaurant = new Restaurant({
    name: 'Coupon Bistro',
    slug: 'coupon-bistro',
    owner: {
      userId: ownerContext.user._id,
      fullName: ownerContext.user.fullName,
      email: ownerContext.user.email,
      mobile: ownerContext.user.mobile,
    },
    location: {
      address: 'Madhapur',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500081',
      geo: { type: 'Point', coordinates: [78.38, 17.44] },
    },
    schedule: { workingDays: ['MON'], openTime: '09:00', closeTime: '22:00' },
    outletType: 'dine_in_only',
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
      cuisines: ['Indian'],
      costForTwo: 500,
    },
    onboarding: { stage: 'verified' },
  });
  await restaurant.save();

  // Re-bind owner context to this restaurant
  await RestaurantStaff.create({
    restaurantId: restaurant._id,
    userId: ownerContext.user._id,
    role: 'owner',
    status: 'active',
  });

  const headers = {
    ...ownerContext.headers,
    'x-restaurant-id': restaurant._id.toString(),
  };

  // Seed Menu Categories
  const pizzaCategory = new MenuCategory({
    restaurantId: restaurant._id,
    name: 'Pizza',
    slug: 'pizza',
    status: 'active',
  });
  await pizzaCategory.save();

  const sidesCategory = new MenuCategory({
    restaurantId: restaurant._id,
    name: 'Sides',
    slug: 'sides',
    status: 'active',
  });
  await sidesCategory.save();

  const drinksCategory = new MenuCategory({
    restaurantId: restaurant._id,
    name: 'Beverages',
    slug: 'beverages',
    status: 'active',
  });
  await drinksCategory.save();

  // Seed Menu Items
  const pizza = new MenuItem({
    restaurantId: restaurant._id,
    categoryId: pizzaCategory._id,
    name: 'Margherita Pizza',
    price: 300,
    category: 'Pizza',
    foodType: 'veg',
    status: 'available',
  });
  await pizza.save();

  const garlicBread = new MenuItem({
    restaurantId: restaurant._id,
    categoryId: sidesCategory._id,
    name: 'Garlic Bread',
    price: 150,
    category: 'Sides',
    foodType: 'veg',
    status: 'available',
  });
  await garlicBread.save();

  const coke = new MenuItem({
    restaurantId: restaurant._id,
    categoryId: drinksCategory._id,
    name: 'Coca Cola',
    price: 50,
    category: 'Beverages',
    foodType: 'veg',
    status: 'available',
  });
  await coke.save();

  return { restaurant, pizza, garlicBread, coke, ownerContext: { ...ownerContext, headers } };
}

describe('Coupons & Discounts System', () => {

  describe('Coupon Management & Security', () => {
    test('should allow platform sales to create a platform-scoped coupon', async () => {
      const { headers: salesHeaders } = await createAuthContext('sales', 'platform');

      const res = await request(app)
        .post('/api/v1/platform/coupons')
        .set(salesHeaders)
        .send({
          code: 'WELCOME100',
          scope: 'platform',
          discountType: 'flat',
          discountValue: 100,
          minOrderValue: 400,
          targetType: 'cart',
          startDate: new Date(Date.now() - 10000),
          endDate: new Date(Date.now() + 100000),
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('WELCOME100');
      expect(res.body.data.scope).toBe('platform');
    });

    test('should allow restaurant owner to create a restaurant-scoped coupon', async () => {
      const { restaurant, ownerContext } = await setupRestaurantAndMenu();

      const res = await request(app)
        .post('/api/v1/platform/coupons')
        .set(ownerContext.headers)
        .send({
          code: 'BISTRO20',
          scope: 'restaurant',
          discountType: 'percentage',
          discountValue: 20,
          minOrderValue: 200,
          targetType: 'cart',
          startDate: new Date(Date.now() - 10000),
          endDate: new Date(Date.now() + 100000),
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('BISTRO20');
      expect(res.body.data.restaurantId).toBe(restaurant._id.toString());
    });

    test('should block non-sales roles from creating platform coupons', async () => {
      const { headers: supportHeaders } = await createAuthContext('support', 'platform');

      await request(app)
        .post('/api/v1/platform/coupons')
        .set(supportHeaders)
        .send({
          code: 'HACK100',
          scope: 'platform',
          discountType: 'flat',
          discountValue: 100,
          minOrderValue: 100,
          targetType: 'cart',
          startDate: new Date(),
          endDate: new Date(),
        })
        .expect(403);
    });

    test('should block duplicate coupon codes', async () => {
      const { headers: salesHeaders } = await createAuthContext('sales', 'platform');

      const payload = {
        code: 'DUPLICATE',
        scope: 'platform',
        discountType: 'flat',
        discountValue: 50,
        targetType: 'cart',
        startDate: new Date(),
        endDate: new Date(Date.now() + 600000),
      };

      await request(app).post('/api/v1/platform/coupons').set(salesHeaders).send(payload).expect(201);
      await request(app).post('/api/v1/platform/coupons').set(salesHeaders).send(payload).expect(409);
    });
  });

  describe('Apply Coupon & Calculator Engine', () => {
    let restaurant, pizza, garlicBread, coke;

    beforeEach(async () => {
      const setup = await setupRestaurantAndMenu();
      restaurant = setup.restaurant;
      pizza = setup.pizza;
      garlicBread = setup.garlicBread;
      coke = setup.coke;
    });

    test('should apply flat discount when minOrderValue is satisfied', async () => {
      const coupon = new Coupon({
        code: 'FLAT50',
        scope: 'platform',
        discountType: 'flat',
        discountValue: 50,
        minOrderValue: 300,
        targetType: 'cart',
        startDate: new Date(Date.now() - 10000),
        endDate: new Date(Date.now() + 100000),
      });
      await coupon.save();

      const res = await request(app)
        .post('/api/v1/coupons/apply')
        .send({
          couponCode: 'FLAT50',
          restaurantId: restaurant._id,
          items: [
            { menuItemId: pizza._id, quantity: 1 }, // ₹300
          ],
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.discountAmount).toBe(50);
    });

    test('should reject flat discount when minOrderValue is NOT satisfied', async () => {
      const coupon = new Coupon({
        code: 'FLAT50',
        scope: 'platform',
        discountType: 'flat',
        discountValue: 50,
        minOrderValue: 300,
        targetType: 'cart',
        startDate: new Date(Date.now() - 10000),
        endDate: new Date(Date.now() + 100000),
      });
      await coupon.save();

      await request(app)
        .post('/api/v1/coupons/apply')
        .send({
          couponCode: 'FLAT50',
          restaurantId: restaurant._id,
          items: [
            { menuItemId: garlicBread._id, quantity: 1 }, // ₹150 (< 300)
          ],
        })
        .expect(400);
    });

    test('should apply percentage discount and respect maxDiscountLimit cap', async () => {
      const coupon = new Coupon({
        code: 'HALFPRICE',
        scope: 'platform',
        discountType: 'percentage',
        discountValue: 50, // 50%
        maxDiscountLimit: 100, // max ₹100 off
        targetType: 'cart',
        startDate: new Date(Date.now() - 10000),
        endDate: new Date(Date.now() + 100000),
      });
      await coupon.save();

      const res = await request(app)
        .post('/api/v1/coupons/apply')
        .send({
          couponCode: 'HALFPRICE',
          restaurantId: restaurant._id,
          items: [
            { menuItemId: pizza._id, quantity: 2 }, // ₹600 subtotal. 50% = ₹300, capped at ₹100
          ],
        })
        .expect(200);

      expect(res.body.data.discountAmount).toBe(100);
    });

    test('should apply item-specific discount whitelists correctly', async () => {
      const coupon = new Coupon({
        code: 'PIZZAPROMO',
        scope: 'platform',
        discountType: 'percentage',
        discountValue: 10, // 10% off pizza only
        targetType: 'item',
        applicableItems: [pizza._id],
        startDate: new Date(Date.now() - 10000),
        endDate: new Date(Date.now() + 100000),
      });
      await coupon.save();

      const res = await request(app)
        .post('/api/v1/coupons/apply')
        .send({
          couponCode: 'PIZZAPROMO',
          restaurantId: restaurant._id,
          items: [
            { menuItemId: pizza._id, quantity: 1 }, // ₹300 (eligible)
            { menuItemId: garlicBread._id, quantity: 1 }, // ₹150 (ignored)
          ],
        })
        .expect(200);

      // Total ₹450, but 10% is calculated only on Pizza (₹300) -> ₹30 off
      expect(res.body.data.discountAmount).toBe(30);
    });

    test('should apply category-specific discount whitelists correctly', async () => {
      const coupon = new Coupon({
        code: 'DRINKFREE',
        scope: 'platform',
        discountType: 'percentage',
        discountValue: 100, // 100% off beverages
        targetType: 'category',
        applicableCategories: ['Beverages'],
        startDate: new Date(Date.now() - 10000),
        endDate: new Date(Date.now() + 100000),
      });
      await coupon.save();

      const res = await request(app)
        .post('/api/v1/coupons/apply')
        .send({
          couponCode: 'DRINKFREE',
          restaurantId: restaurant._id,
          items: [
            { menuItemId: pizza._id, quantity: 1 }, // ₹300
            { menuItemId: coke._id, quantity: 2 }, // ₹100 total coke (eligible)
          ],
        })
        .expect(200);

      expect(res.body.data.discountAmount).toBe(100); // coke is fully free
    });

    test('should block expired or exhausted coupons', async () => {
      // 1. Expired
      const expired = new Coupon({
        code: 'OLDCODE',
        scope: 'platform',
        discountType: 'flat',
        discountValue: 10,
        startDate: new Date(Date.now() - 20000),
        endDate: new Date(Date.now() - 10000),
        targetType: 'cart',
      });
      await expired.save();

      await request(app)
        .post('/api/v1/coupons/apply')
        .send({ couponCode: 'OLDCODE', restaurantId: restaurant._id, items: [{ menuItemId: pizza._id, quantity: 1 }] })
        .expect(400);

      // 2. Exhausted
      const exhausted = new Coupon({
        code: 'MAXOUT',
        scope: 'platform',
        discountType: 'flat',
        discountValue: 10,
        startDate: new Date(Date.now() - 10000),
        endDate: new Date(Date.now() + 100000),
        targetType: 'cart',
        usageLimit: 5,
        usageCount: 5,
      });
      await exhausted.save();

      await request(app)
        .post('/api/v1/coupons/apply')
        .send({ couponCode: 'MAXOUT', restaurantId: restaurant._id, items: [{ menuItemId: pizza._id, quantity: 1 }] })
        .expect(400);
    });
  });

  describe('Dine-In QR Order Coupon Placement', () => {
    let restaurant, pizza, table;

    beforeEach(async () => {
      const setup = await setupRestaurantAndMenu();
      restaurant = setup.restaurant;
      pizza = setup.pizza;

      // Seed Table
      table = new Table({
        restaurantId: restaurant._id,
        tableNumber: 'T-10',
        capacity: 4,
        qrCode: {
          code: 'qr_coupon_t10',
          isActive: true,
        },
        status: 'occupied',
        activeSession: {
          customerName: 'Aria Doe',
          deviceId: 'aria_phone_123',
          orderIds: [],
        },
      });
      await table.save();
    });

    test('should place dine-in QR order with coupon code and atomically increment coupon usage count', async () => {
      const coupon = new Coupon({
        code: 'BISTROSAVE',
        scope: 'restaurant',
        restaurantId: restaurant._id,
        discountType: 'flat',
        discountValue: 50,
        minOrderValue: 200,
        targetType: 'cart',
        startDate: new Date(Date.now() - 10000),
        endDate: new Date(Date.now() + 100000),
      });
      await coupon.save();

      const res = await request(app)
        .post('/api/v1/tables/order')
        .send({
          code: 'qr_coupon_t10',
          deviceId: 'aria_phone_123',
          couponCode: 'BISTROSAVE',
          items: [
            { itemId: pizza._id, quantity: 1 }, // ₹300
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.totals.discount).toBe(50);
      expect(res.body.data.totals.couponCode).toBe('BISTROSAVE');
      // Subtotal ₹300 + 5% tax (₹15) - ₹50 discount = ₹265
      expect(res.body.data.totals.grandTotal).toBe(265);

      // Verify database updates
      const updatedCoupon = await Coupon.findById(coupon._id);
      expect(updatedCoupon.usageCount).toBe(1); // atomically incremented
    });
  });
});
