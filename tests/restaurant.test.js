const request = require('supertest');
const app = require('../src/app');
const {
  setupTestDB,
  cleanupTestDB,
  clearDBCollections,
  createPlatformAdmin,
  registerAndApproveRestaurant,
  createPendingRestaurant,
} = require('./helpers');
const Restaurant = require('../src/models/restaurant.model');
const User = require('../src/models/user.model');
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

describe('Restaurant API (/api/v1/restaurants)', () => {
  describe('Onboarding Management (Platform Admin Scope)', () => {
    test('should allow platform admin to list pending onboarding applications', async () => {
      const { headers: adminHeaders } = await createPlatformAdmin();

      // Create a pending restaurant application
      const owner = new User({
        fullName: 'Pending Owner',
        email: 'pending@test.com',
        mobile: '+917777777777',
        passwordHash: 'pass123',
        status: 'suspended',
      });
      await owner.save();

      const restaurant = await createPendingRestaurant(owner);

      const res = await request(app)
        .get('/api/v1/platform/restaurants/onboarding/pending')
        .set(adminHeaders)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Pending Diner');
    });

    test('should block non-admins from listing pending onboardings', async () => {
      const { headers: ownerHeaders } = await registerAndApproveRestaurant();

      await request(app)
        .get('/api/v1/platform/restaurants/onboarding/pending')
        .set(ownerHeaders)
        .expect(403);
    });

    test('should allow platform admin to approve onboarding application', async () => {
      const { headers: adminHeaders, user: admin } = await createPlatformAdmin();

      const owner = new User({
        fullName: 'Pending Owner',
        email: 'pending@test.com',
        mobile: '+917777777777',
        passwordHash: 'pass123',
        status: 'suspended',
      });
      await owner.save();

      const restaurant = await createPendingRestaurant(owner);

      // Set stage to verified so approval is allowed (Phase 4 requirement)
      restaurant.onboarding.stage = 'verified';
      await restaurant.save();

      const res = await request(app)
        .post(`/api/v1/platform/restaurants/onboarding/${restaurant._id}/review`)
        .set(adminHeaders)
        .send({ action: 'approve' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('approved successfully');

      // Check owner status is now active
      const updatedOwner = await User.findById(owner._id);
      expect(updatedOwner.status).toBe('active');

      // Check staff entry created
      const staffEntry = await RestaurantStaff.findOne({ restaurantId: restaurant._id, userId: owner._id });
      expect(staffEntry).toBeTruthy();
      expect(staffEntry.role).toBe('owner');
    });

    test('should allow platform admin to reject onboarding application with reason', async () => {
      const { headers: adminHeaders } = await createPlatformAdmin();

      const owner = new User({
        fullName: 'Pending Owner',
        email: 'pending@test.com',
        mobile: '+917777777777',
        passwordHash: 'pass123',
        status: 'suspended',
      });
      await owner.save();

      const restaurant = await createPendingRestaurant(owner);

      const res = await request(app)
        .post(`/api/v1/platform/restaurants/onboarding/${restaurant._id}/review`)
        .set(adminHeaders)
        .send({ action: 'reject', rejectionReason: 'Documents are unreadable.' })
        .expect(200);

      expect(res.body.success).toBe(true);

      const updatedRestaurant = await Restaurant.findById(restaurant._id);
      expect(updatedRestaurant.onboarding.stage).toBe('rejected');
      expect(updatedRestaurant.onboarding.rejectionReason).toBe('Documents are unreadable.');
    });
  });

  describe('Restaurant Profile & Details (Tenant Scope)', () => {
    test('should retrieve full restaurant profile for the owner user', async () => {
      const { headers, restaurant } = await registerAndApproveRestaurant();

      const res = await request(app)
        .get('/api/v1/restaurants/profile')
        .set(headers)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(restaurant._id.toString());
      expect(res.body.data.legal.pan).toBe('ABCDE1234F'); // Not redacted for owner
      expect(res.body.data.bank.accountNumber).toBe('987654321012'); // Not redacted for owner
    });

    test('should retrieve redacted restaurant profile for non-owner staff roles (e.g. chef)', async () => {
      const { restaurant, token } = await registerAndApproveRestaurant();

      // Seed a Chef staff member
      const chefUser = new User({
        fullName: 'Chef Dan',
        email: 'dan@test.com',
        mobile: '+911111222233',
        passwordHash: 'pass123',
        status: 'active',
      });
      await chefUser.save();

      const staffRole = new RestaurantStaff({
        restaurantId: restaurant._id,
        userId: chefUser._id,
        role: 'chef',
        permissions: ['order_read', 'order_update'],
        screenAccess: ['*'],
        status: 'active',
      });
      await staffRole.save();

      const chefToken = generateAccessToken(chefUser, 'user');
      const chefHeaders = {
        Authorization: `Bearer ${chefToken}`,
        'x-restaurant-id': restaurant._id.toString(),
      };

      const res = await request(app)
        .get('/api/v1/restaurants/profile')
        .set(chefHeaders)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.legal.pan).toBe('[REDACTED]');
      expect(res.body.data.bank.accountNumber).toBe('[REDACTED]');
    });

    test('should allow owner to update restaurant profile configuration', async () => {
      const { headers } = await registerAndApproveRestaurant();

      const res = await request(app)
        .patch('/api/v1/restaurants/profile')
        .set(headers)
        .send({
          name: 'Updated Restaurant Name',
          schedule: {
            workingDays: ['MON', 'TUE', 'WED', 'THU'],
            openTime: '12:00',
            closeTime: '22:00',
          },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Restaurant Name');
      expect(res.body.data.schedule.workingDays).toEqual(['MON', 'TUE', 'WED', 'THU']);
    });

    test('should prevent chef from updating restaurant profile', async () => {
      const { restaurant } = await registerAndApproveRestaurant();

      const chefUser = new User({
        fullName: 'Chef Dan',
        email: 'dan@test.com',
        mobile: '+911111222233',
        passwordHash: 'pass123',
        status: 'active',
      });
      await chefUser.save();

      const staffRole = new RestaurantStaff({
        restaurantId: restaurant._id,
        userId: chefUser._id,
        role: 'chef',
        status: 'active',
      });
      await staffRole.save();

      const chefToken = generateAccessToken(chefUser, 'user');

      await request(app)
        .patch('/api/v1/restaurants/profile')
        .set({
          Authorization: `Bearer ${chefToken}`,
          'x-restaurant-id': restaurant._id.toString(),
        })
        .send({ name: 'Hack Name' })
        .expect(403);
    });

    test('should allow owner to upload profile avatar image via ImageKit/fallback storage', async () => {
      const { headers } = await registerAndApproveRestaurant();

      const res = await request(app)
        .post('/api/v1/restaurants/profile/image')
        .set(headers)
        .attach('image', Buffer.from('fake_image_binary_data'), 'avatar.png')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.imageUrl).toBe('string');
      expect(res.body.data.imageUrl.length).toBeGreaterThan(0);
    });

    test('should allow owner to upload background cover banner image via ImageKit/fallback storage', async () => {
      const { headers } = await registerAndApproveRestaurant();

      const res = await request(app)
        .post('/api/v1/restaurants/profile/cover')
        .set(headers)
        .attach('image', Buffer.from('fake_image_binary_data'), 'cover_banner.png')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.coverImage).toBe('string');
      expect(res.body.data.coverImage.length).toBeGreaterThan(0);
    });
  });
});

