const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, cleanupTestDB, clearDBCollections } = require('./helpers');
const User = require('../src/models/user.model');
const Restaurant = require('../src/models/restaurant.model');

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await cleanupTestDB();
});

beforeEach(async () => {
  await clearDBCollections();
});

describe('Authentication API (/api/v1/auth)', () => {
  const validRegistrationPayload = {
    ownerName: 'Alice Green',
    email: 'alice@greenkitchen.com',
    mobile: '+919911223344',
    whatsapp: '+919911223344',
    restaurantName: 'Green Kitchen',
    location: {
      address: '456 Garden Lane',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500081',
      coordinates: [78.43, 17.45],
    },
    schedule: {
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      openTime: '08:00',
      closeTime: '22:00',
    },
    outletType: 'dine_in_and_delivery',
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
    menuSetup: {
      foodType: 'veg_only',
      cuisines: ['South Indian', 'Salads'],
      costForTwo: 400,
    },
    termsAccepted: true,
  };

  describe('POST /register', () => {
    test('should successfully register restaurant application', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegistrationPayload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('submitted successfully');
      expect(res.body.data.application.restaurantName).toBe('Green Kitchen');

      // Check DB records
      const user = await User.findOne({ email: 'alice@greenkitchen.com' });
      expect(user).toBeTruthy();
      expect(user.status).toBe('suspended'); // Suspended until onboarding review

      const restaurant = await Restaurant.findOne({ name: 'Green Kitchen' });
      expect(restaurant).toBeTruthy();
      expect(restaurant.onboarding.stage).toBe('submitted');
    });

    test('should fail with validation errors on missing fields', async () => {
      const invalidPayload = { ...validRegistrationPayload };
      delete invalidPayload.ownerName; // Required field missing

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(invalidPayload)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors.ownerName).toContain('required');
    });

    test('should fail when email format is invalid', async () => {
      const invalidPayload = { ...validRegistrationPayload, email: 'notanemail' };

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(invalidPayload)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    test('should prevent duplicate email registration', async () => {
      // First registration
      await request(app)
        .post('/api/v1/auth/register')
        .send(validRegistrationPayload)
        .expect(201);

      // Duplicate registration
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegistrationPayload,
          restaurantName: 'Green Kitchen 2', // Different slug
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('exists');
    });
  });

  describe('POST /login', () => {
    test('should deny access to registered owners who are not approved yet (suspended status)', async () => {
      // Register
      await request(app)
        .post('/api/v1/auth/register')
        .send(validRegistrationPayload);

      // Login attempt
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'alice@greenkitchen.com',
          password: 'temp_password', // Any password will hit status check
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('suspended');
    });

    test('should log in successfully with valid credentials for active users', async () => {
      // Seed an active user
      const user = new User({
        fullName: 'Active User',
        email: 'active@user.com',
        mobile: '+919876543210',
        passwordHash: 'mypassword123',
        status: 'active',
      });
      await user.save();

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'active@user.com',
          password: 'mypassword123',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens.accessToken).toBeTruthy();
      expect(res.body.data.tokens.refreshToken).toBeTruthy();
      expect(res.body.data.user.email).toBe('active@user.com');
    });

    test('should reject login for platform admin users on partner login page', async () => {
      const adminUser = new User({
        fullName: 'Platform Admin',
        email: 'admin@platform.com',
        mobile: '+919876543299',
        passwordHash: 'mypassword123',
        globalRole: 'platform_admin',
        status: 'active',
      });
      await adminUser.save();

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'admin@platform.com',
          password: 'mypassword123',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid login credentials.');
    });

    test('should return 401 on incorrect password', async () => {
      const user = new User({
        fullName: 'Active User',
        email: 'active@user.com',
        mobile: '+919876543210',
        passwordHash: 'mypassword123',
        status: 'active',
      });
      await user.save();

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'active@user.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /refresh', () => {
    test('should issue new access & refresh tokens on valid refresh token', async () => {
      const user = new User({
        fullName: 'Active User',
        email: 'active@user.com',
        mobile: '+919876543210',
        passwordHash: 'mypassword123',
        status: 'active',
      });
      await user.save();

      // Log in to get refresh token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'active@user.com',
          password: 'mypassword123',
        });

      const { refreshToken } = loginRes.body.data.tokens;

      // Refresh token call
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.tokens.accessToken).toBeTruthy();
      expect(refreshRes.body.data.tokens.refreshToken).toBeTruthy();
    });

    test('should fail with 401 on invalid/expired refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid_token' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /logout', () => {
    test('should return success response confirming logout', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('logged out');
    });
  });
});
