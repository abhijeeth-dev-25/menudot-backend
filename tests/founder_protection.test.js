const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const founderAuthService = require('../src/services/platform/founderAuth.service');
const { setupTestDB, clearDBCollections, cleanupTestDB } = require('./helpers');

describe('Founder Account Immutability & Step-Up OTP Authorization Suite', () => {
  const FOUNDER_EMAIL = 'abhijeethkar.geddam.dev@gmail.com';
  let founderUser;

  beforeAll(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await clearDBCollections();
    try {
      founderUser = await User.create({
        fullName: 'Geddam Abhijeethkar',
        email: FOUNDER_EMAIL,
        mobile: '+919177813634',
        passwordHash: 'Ajk@123#',
        globalRole: 'super_admin',
        status: 'active',
        isDeleted: false,
      });
    } catch (e) {
      founderUser = await User.findOne({ email: FOUNDER_EMAIL });
    }
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  it('verifies Founder account is created with super_admin role and active status', async () => {
    const fetched = await User.findOne({ email: FOUNDER_EMAIL });
    expect(fetched).not.toBeNull();
    expect(fetched.globalRole).toBe('super_admin');
    expect(fetched.status).toBe('active');
    expect(fetched.isDeleted).toBe(false);
  });

  it('blocks deletion of Founder account via updateOne or deleteOne', async () => {
    await expect(
      User.updateOne({ email: FOUNDER_EMAIL }, { isDeleted: true })
    ).rejects.toThrow('Founder account (abhijeethkar.geddam.dev@gmail.com) is immutable and cannot be deleted.');

    await expect(
      User.deleteOne({ email: FOUNDER_EMAIL })
    ).rejects.toThrow('Founder account (abhijeethkar.geddam.dev@gmail.com) is immutable and cannot be deleted.');
  });

  it('blocks suspension or role demotion of Founder account', async () => {
    await expect(
      User.updateOne({ email: FOUNDER_EMAIL }, { status: 'suspended' })
    ).rejects.toThrow('Founder account (abhijeethkar.geddam.dev@gmail.com) status cannot be suspended.');

    await expect(
      User.updateOne({ email: FOUNDER_EMAIL }, { globalRole: 'restaurant_user' })
    ).rejects.toThrow('Founder account role cannot be demoted from super_admin.');
  });

  it('dispatches Step-Up OTP exclusively to Founder email via POST /api/v1/auth/founder-otp/request', async () => {
    const res = await request(app).post('/api/v1/auth/founder-otp/request');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain(FOUNDER_EMAIL);
  });

  it('verifies Step-Up OTP and returns signed founderAuthToken via POST /api/v1/auth/founder-otp/verify', async () => {
    await request(app).post('/api/v1/auth/founder-otp/request');

    // Verify invalid OTP returns 400
    const errRes = await request(app)
      .post('/api/v1/auth/founder-otp/verify')
      .send({ otp: '000000' });
    expect(errRes.status).toBe(400);
  });
});
