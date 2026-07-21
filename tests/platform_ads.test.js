const request = require('supertest');
const app = require('../src/app');
const {
  setupTestDB,
  cleanupTestDB,
  clearDBCollections,
} = require('./helpers');
const User = require('../src/models/user.model');
const PlatformCampaign = require('../src/models/platformCampaign.model');
const AdCreative = require('../src/models/adCreative.model');
const AdTargetingRule = require('../src/models/adTargetingRule.model');
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

describe('Universal Ad Server Platform', () => {

  describe('Campaign Provisioning & Permissions', () => {
    test('should allow platform sales to create ad campaign with creative & targeting', async () => {
      const { headers: salesHeaders } = await createPlatformUser('sales');

      const res = await request(app)
        .post('/api/v1/platform/ads')
        .set(salesHeaders)
        .send({
          campaign: {
            name: 'Coca Cola Summer Campaign',
            pricing: {
              model: 'CPC',
              costPerUnit: 1.5,
              totalBudget: 500,
              dailyBudget: 50,
            },
            schedule: {
              startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
              endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
            },
          },
          creative: {
            placementKey: 'qr_menu_banner',
            format: 'image',
            assets: {
              mediaUrl: 'https://cdn.coke.com/banner.png',
              headingText: 'Refresh Yourself',
              bodyText: 'Get a cold coke now!',
            },
            destinationUrl: 'https://coke.com/buy',
          },
          targeting: {
            geoScope: {
              cities: ['Hyderabad', 'Bangalore'],
            },
            targetTags: ['beverages', 'cold_drinks'],
          },
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.campaign.name).toBe('Coca Cola Summer Campaign');
      expect(res.body.data.creative.placementKey).toBe('qr_menu_banner');
      expect(res.body.data.targeting.geoScope.cities).toContain('Hyderabad');
    });

    test('should block non-sales roles from creating campaigns', async () => {
      const { headers: supportHeaders } = await createPlatformUser('support');

      await request(app)
        .post('/api/v1/platform/ads')
        .set(supportHeaders)
        .send({ campaign: {}, creative: {}, targeting: {} })
        .expect(403);
    });
  });

  describe('Ad Serving & Targeting Engine', () => {
    let salesHeaders, advertiserId;

    beforeEach(async () => {
      const salesUser = await createPlatformUser('sales');
      salesHeaders = salesUser.headers;
      advertiserId = salesUser.user._id;
    });

    test('should serve ad matching the client context tags and geo location', async () => {
      // 1. Create a campaign targeting Hyderabad and 'veg' tag
      await request(app)
        .post('/api/v1/platform/ads')
        .set(salesHeaders)
        .send({
          campaign: {
            advertiserId,
            name: 'Veg Salad Promo',
            status: 'active',
            pricing: { model: 'CPC', costPerUnit: 2.0, totalBudget: 100, dailyBudget: 20 },
            schedule: {
              startDate: new Date(Date.now() - 60000),
              endDate: new Date(Date.now() + 600000),
            },
          },
          creative: {
            placementKey: 'qr_menu_banner',
            format: 'image',
            assets: { mediaUrl: 'salad.png' },
            destinationUrl: 'https://salad.com',
          },
          targeting: {
            geoScope: { cities: ['Hyderabad'] },
            targetTags: ['veg'],
          },
        });

      // 2. Query ad with matching context -> should return the ad
      let serveRes = await request(app)
        .get('/api/v1/platform/ads/serve?placementKey=qr_menu_banner&city=Hyderabad&tags=veg,healthy')
        .expect(200);

      expect(serveRes.body.success).toBe(true);
      expect(serveRes.body.data).not.toBeNull();
      expect(serveRes.body.data.creative.assets.mediaUrl).toBe('salad.png');
      expect(serveRes.body.data.trackingToken).toBeDefined();

      // 3. Query ad with non-matching context -> should return null
      serveRes = await request(app)
        .get('/api/v1/platform/ads/serve?placementKey=qr_menu_banner&city=Delhi&tags=nonveg')
        .expect(200);

      expect(serveRes.body.data).toBeNull();
    });
  });

  describe('Event Tracking & Budget Billing', () => {
    let salesHeaders, advertiserId;

    beforeEach(async () => {
      const salesUser = await createPlatformUser('sales');
      salesHeaders = salesUser.headers;
      advertiserId = salesUser.user._id;
    });

    test('should charge CPC campaign budgets on click events, and pause campaign once budget limit is hit', async () => {
      // 1. Create a tiny budget CPC campaign ($5 total, $5 daily, $2.50 CPC)
      const setupRes = await request(app)
        .post('/api/v1/platform/ads')
        .set(salesHeaders)
        .send({
          campaign: {
            advertiserId,
            name: 'Tiny Budget Promo',
            status: 'active',
            pricing: { model: 'CPC', costPerUnit: 2.50, totalBudget: 5.0, dailyBudget: 5.0 },
            schedule: {
              startDate: new Date(Date.now() - 60000),
              endDate: new Date(Date.now() + 600000),
            },
          },
          creative: {
            placementKey: 'qr_menu_banner',
            format: 'image',
            assets: { mediaUrl: 'promo.png' },
            destinationUrl: 'https://promo.com',
          },
          targeting: {},
        });

      const campaignId = setupRes.body.data.campaign._id;

      // 2. Fetch/serve the ad to get a tracking token
      const serveRes = await request(app)
        .get('/api/v1/platform/ads/serve?placementKey=qr_menu_banner')
        .expect(200);

      const token = serveRes.body.data.trackingToken;
      expect(token).toBeDefined();

      // 3. Fire impression event (CPC campaigns should NOT charge for impressions)
      let eventRes = await request(app)
        .post('/api/v1/platform/ads/events')
        .send({ token, eventType: 'impression' })
        .expect(200);

      let updatedCampaign = await PlatformCampaign.findById(campaignId);
      expect(updatedCampaign.pricing.spentTotal).toBe(0); // unchanged

      // 4. Fire first click event
      eventRes = await request(app)
        .post('/api/v1/platform/ads/events')
        .send({ token, eventType: 'click' })
        .expect(200);

      expect(eventRes.body.data.currentSpent).toBe(2.50);
      expect(eventRes.body.data.status).toBe('active');

      // 5. Fire second click event (hits total limit of $5)
      eventRes = await request(app)
        .post('/api/v1/platform/ads/events')
        .send({ token, eventType: 'click' })
        .expect(200);

      expect(eventRes.body.data.currentSpent).toBe(5.0);
      expect(eventRes.body.data.status).toBe('completed'); // status auto-updates to completed
    });

    test('should reject events with tampered or invalid tracking tokens', async () => {
      await request(app)
        .post('/api/v1/platform/ads/events')
        .send({ token: 'fake_jwt_token', eventType: 'click' })
        .expect(400);
    });
  });
});
