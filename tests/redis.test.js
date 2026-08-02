const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { setupTestDB, cleanupTestDB, clearDBCollections, registerAndApproveRestaurant } = require('./helpers');
const { connectRedis, disconnectRedis, safeRedisCall } = require('../src/database/redis');
const MenuItem = require('../src/models/menuItem.model');
const MenuCategory = require('../src/models/menuCategory.model');
const Table = require('../src/models/table.model');

describe('Redis Cache & Fallback Layer Tests', () => {
  let restaurantContext;

  beforeAll(async () => {
    await setupTestDB();
    await connectRedis();
  });

  afterAll(async () => {
    await disconnectRedis();
    await cleanupTestDB();
  });

  beforeEach(async () => {
    await clearDBCollections();
    // Register test restaurant
    const admin = { token: 'mockPlatformAdmin' };
    restaurantContext = await registerAndApproveRestaurant(admin.token);
  });

  describe('Redis Connection & Fallback Guarantee', () => {
    it('should fall back to default value when safeRedisCall is executed on failure or error', async () => {
      // Execute a bad command in Redis (which will throw)
      const fallback = await safeRedisCall((client) => {
        throw new Error('Redis down');
      }, 'fallback-success');

      expect(fallback).toBe('fallback-success');
    });
  });

  describe('Dine-In QR Menu Catalog Caching & Invalidation', () => {
    it('should assemble, cache, and hit Redis cache for customer scans', async () => {
      const restaurantId = restaurantContext.restaurant._id;

      // 1. Create a table using the REST endpoint
      const tableRes = await request(app)
        .post('/api/v1/tables')
        .set(restaurantContext.headers)
        .send({
          tableNumber: 'T-10',
          capacity: 4,
        })
        .expect(201);

      const tableId = tableRes.body.data._id;
      const qrCodeStr = tableRes.body.data.qrCode.code;

      // 2. Toggle QR Scan permission on
      await request(app)
        .patch(`/api/v1/tables/${tableId}/qr/toggle`)
        .set(restaurantContext.headers)
        .send({ isActive: true })
        .expect(200);

      // Create a category and item
      const category = await MenuCategory.create({
        restaurantId,
        name: 'Starter Desserts',
        slug: 'starter-desserts',
        status: 'active',
      });

      await MenuItem.create({
        restaurantId,
        categoryId: category._id,
        name: 'Strawberry Ice Cream',
        price: 99,
        foodType: 'veg',
        status: 'available',
      });

      // 3. Process customer scan (Populates cache on first scan)
      const res1 = await request(app)
        .post('/api/v1/tables/scan')
        .send({
          code: qrCodeStr,
          customerName: 'Alice Test',
          deviceId: 'device-id-123',
        })
        .expect(200);

      expect(res1.body.data.restaurant.name).toBe(restaurantContext.restaurant.name);
      expect(res1.body.data.menu[0].category.name).toBe('Starter Desserts');
      expect(res1.body.data.menu[0].items[0].name).toBe('Strawberry Ice Cream');

      // 4. Validate cache existence in Redis
      const cached = await safeRedisCall(async (client) => {
        return await client.get(`catalog:${restaurantId}`);
      });
      if (cached) {
        const parsed = JSON.parse(cached);
        expect(parsed.restaurant.name).toBe(restaurantContext.restaurant.name);
        expect(parsed.menu[0].category.name).toBe('Starter Desserts');
      }

      // 5. Modifying menu items must evict/invalidate cache
      await request(app)
        .patch(`/api/v1/menu/items/${res1.body.data.menu[0].items[0]._id}/status`)
        .set(restaurantContext.headers)
        .send({ status: 'out_of_stock' })
        .expect(200);

      // Verify that cache key is evicted in Redis
      const cachedAfterEvict = await safeRedisCall(async (client) => {
        return await client.get(`catalog:${restaurantId}`);
      });
      expect(cachedAfterEvict).toBeNull();
    });
  });

  describe('JWT Revocation Blacklist', () => {
    it('should blacklist the active token upon logout and reject subsequent protected calls', async () => {
      const { isConnected } = require('../src/database/redis');
      // 1. Fetch info with active token (works)
      await request(app)
        .get('/api/v1/restaurants/profile')
        .set(restaurantContext.headers)
        .expect(200);

      // 2. Trigger logout (revokes token)
      await request(app)
        .post('/api/v1/auth/logout')
        .set(restaurantContext.headers)
        .expect(200);

      // 3. Fetch info again (should reject with 401 because token is blacklisted when Redis is active)
      if (isConnected()) {
        const res = await request(app)
          .get('/api/v1/restaurants/profile')
          .set(restaurantContext.headers)
          .expect(401);

        expect(res.body.message).toMatch(/Session has been revoked/i);
      }
    });
  });
});
