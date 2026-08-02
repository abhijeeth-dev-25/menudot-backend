const request = require('supertest');
const app = require('../src/app');
const {
  setupTestDB,
  cleanupTestDB,
  clearDBCollections,
} = require('./helpers');
const User = require('../src/models/user.model');
const Restaurant = require('../src/models/restaurant.model');
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

// Helper to create platform users
async function createPlatformUser(role) {
  const user = new User({
    fullName: `Platform ${role}`,
    email: `${role}@menudot.com`,
    mobile: `+9100000000${Math.floor(Math.random() * 90 + 10)}`,
    passwordHash: 'password123',
    globalRole: role,
    status: 'active',
  });
  await user.save();

  const token = generateAccessToken(user, 'user');
  return {
    user,
    token,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

async function createSubmittedRestaurant() {
  const owner = new User({
    fullName: 'Bistro Owner',
    email: 'owner@bistro.com',
    mobile: '+919999990001',
    passwordHash: 'password123',
    globalRole: 'restaurant_user',
    status: 'suspended',
  });
  await owner.save();

  const restaurant = new Restaurant({
    name: 'Bistro Test',
    slug: 'bistro-test',
    owner: {
      userId: owner._id,
      fullName: owner.fullName,
      email: owner.email,
      mobile: owner.mobile,
    },
    location: {
      address: 'Hitech City',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500081',
      geo: { type: 'Point', coordinates: [78.4, 17.4] },
    },
    schedule: {
      workingDays: ['MON', 'TUE'],
      openTime: '10:00',
      closeTime: '22:00',
    },
    outletType: 'dine_in_only',
    legal: {
      pan: 'ABCDE1234F',
      gstin: '36ABCDE1234F1Z5',
      fssaiNumber: '12345678901234',
      fssaiExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
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
    onboarding: {
      stage: 'submitted',
      submittedAt: new Date(),
    },
  });
  await restaurant.save();
  return { owner, restaurant };
}

describe('MenuDot Platform Roles & Onboarding Workflows', () => {
  
  describe('Document Verification Flow (Verification Team)', () => {
    test('should allow Verification Team member to view pending verifications', async () => {
      const { headers: verifierHeaders } = await createPlatformUser('verification');
      await createSubmittedRestaurant();

      const res = await request(app)
        .get('/api/v1/platform/restaurants/verification/pending')
        .set(verifierHeaders)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    test('should block non-verification roles from pending verifications queue', async () => {
      const { headers: supportHeaders } = await createPlatformUser('support');

      await request(app)
        .get('/api/v1/platform/restaurants/verification/pending')
        .set(supportHeaders)
        .expect(403);
    });

    test('should transition restaurant onboarding to under_review on first doc verify, and verified once all docs checked', async () => {
      const { headers: verifierHeaders } = await createPlatformUser('verification');
      const { restaurant } = await createSubmittedRestaurant();

      // 1. Verify PAN
      let res = await request(app)
        .post(`/api/v1/platform/restaurants/onboarding/${restaurant._id}/verify`)
        .set(verifierHeaders)
        .send({ docType: 'pan', isVerified: true })
        .expect(200);

      expect(res.body.data.onboarding.stage).toBe('under_review');
      expect(res.body.data.onboarding.verificationChecklist.panVerified).toBe(true);
      expect(res.body.data.onboarding.verificationChecklist.gstinVerified).toBe(false);

      // 2. Verify remaining docs
      await request(app)
        .post(`/api/v1/platform/restaurants/onboarding/${restaurant._id}/verify`)
        .set(verifierHeaders)
        .send({ docType: 'gstin', isVerified: true })
        .expect(200);

      await request(app)
        .post(`/api/v1/platform/restaurants/onboarding/${restaurant._id}/verify`)
        .set(verifierHeaders)
        .send({ docType: 'fssai', isVerified: true })
        .expect(200);

      res = await request(app)
        .post(`/api/v1/platform/restaurants/onboarding/${restaurant._id}/verify`)
        .set(verifierHeaders)
        .send({ docType: 'bank', isVerified: true })
        .expect(200);

      // Now all 4 documents are checked, stage should auto-update to 'verified'
      expect(res.body.data.onboarding.stage).toBe('verified');
      expect(res.body.data.onboarding.verifiedBy).toBeTruthy();
    });
  });

  describe('Restaurant Activation Flow (Platform Admin)', () => {
    test('should block platform admin from approving restaurant before verification', async () => {
      const { headers: adminHeaders } = await createPlatformUser('platform_admin');
      const { restaurant } = await createSubmittedRestaurant();

      // Attempt to approve immediately (stage = submitted) -> should fail with 400
      const res = await request(app)
        .post(`/api/v1/platform/restaurants/onboarding/${restaurant._id}/review`)
        .set(adminHeaders)
        .send({ action: 'approve' })
        .expect(400);

      expect(res.body.message).toContain('must be verified by the Verification Team first');
    });

    test('should allow platform admin to approve restaurant after document verification matches stage verified', async () => {
      const { headers: adminHeaders } = await createPlatformUser('platform_admin');
      const { restaurant, owner } = await createSubmittedRestaurant();

      // Simulate verification completion
      restaurant.onboarding.verificationChecklist = {
        panVerified: true,
        gstinVerified: true,
        fssaiVerified: true,
        bankVerified: true,
      };
      restaurant.onboarding.stage = 'verified';
      await restaurant.save();

      const res = await request(app)
        .post(`/api/v1/platform/restaurants/onboarding/${restaurant._id}/review`)
        .set(adminHeaders)
        .send({ action: 'approve' })
        .expect(200);

      expect(res.body.success).toBe(true);

      // Owner should now be active, and mapped to restaurant staff
      const updatedOwner = await User.findById(owner._id);
      expect(updatedOwner.status).toBe('active');

      const staff = await RestaurantStaff.findOne({ userId: owner._id, restaurantId: restaurant._id });
      expect(staff).toBeTruthy();
      expect(staff.role).toBe('owner');
    });
  });

  describe('Super Admin Scope Controls', () => {
    test('should allow super admin to pull system stats', async () => {
      const { headers: superAdminHeaders } = await createPlatformUser('super_admin');

      const res = await request(app)
        .get('/api/v1/platform/system/stats')
        .set(superAdminHeaders)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.dbName).toMatch(/^menudot(_test)?$/);
    });

    test('should block platform admins from pulling system stats', async () => {
      const { headers: adminHeaders } = await createPlatformUser('platform_admin');

      await request(app)
        .get('/api/v1/platform/system/stats')
        .set(adminHeaders)
        .expect(403);
    });

    test('should allow super admin to provision new team members', async () => {
      const { headers: superAdminHeaders } = await createPlatformUser('super_admin');

      const res = await request(app)
        .post('/api/v1/platform/system/users')
        .set(superAdminHeaders)
        .send({
          fullName: 'Audit Professional',
          email: 'audit_team@menudot.com',
          mobile: '+919999000888',
          password: 'securepassword123',
          globalRole: 'audit',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.globalRole).toBe('audit');

      const created = await User.findOne({ email: 'audit_team@menudot.com' });
      expect(created).toBeTruthy();
      expect(created.globalRole).toBe('audit');
    });
  });
});
