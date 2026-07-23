delete process.env.SMTP_HOST;
const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, cleanupTestDB, clearDBCollections } = require('./helpers');
const queueManager = require('../src/queues/queueManager');
const { enqueueEmailJob } = require('../src/queues/workers/emailWorker');
const { enqueueAdEventJob } = require('../src/queues/workers/adEventWorker');
const { enqueueWebhookJob } = require('../src/queues/workers/webhookWorker');

describe('Phase 3 & 4: Async Task Queues & Prometheus Metrics Test Suite', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  beforeEach(async () => {
    delete process.env.SMTP_HOST;
    await clearDBCollections();
  });

  describe('1. Background Task Queue Enqueueing & Processing', () => {
    it('should enqueue and process background email job via queue manager', async () => {
      const result = await enqueueEmailJob({
        to: 'queue_test@menudot.com',
        subject: 'Background Email Test',
        text: 'Testing background email worker queue',
      });

      expect(result).toBeDefined();
      expect(result.jobId).toBeDefined();
    });

    it('should enqueue and process ad event tracking job asynchronously', async () => {
      const result = await enqueueAdEventJob({
        token: 'mock_ad_token_123',
        eventType: 'impression',
      });

      expect(result).toBeDefined();
      expect(result.jobId).toBeDefined();
    });

    it('should enqueue and process aggregator webhook payload job asynchronously', async () => {
      const result = await enqueueWebhookJob({
        provider: 'swiggy',
        eventType: 'order_update',
        data: { orderId: 'SWIGGY_101' },
      });

      expect(result).toBeDefined();
      expect(result.jobId).toBeDefined();
    });
  });

  describe('2. Prometheus Metrics & Observability Endpoint', () => {
    it('should collect HTTP request metrics and expose plain-text Prometheus format at /metrics', async () => {
      // Trigger a health check to increment request count
      await request(app).get('/health').expect(200);

      // Scrape Prometheus metrics
      const metricsRes = await request(app).get('/metrics').expect(200);

      expect(metricsRes.headers['content-type']).toContain('text/plain');
      expect(metricsRes.text).toContain('http_requests_total');
      expect(metricsRes.text).toContain('http_requests_by_status');
      expect(metricsRes.text).toContain('http_request_duration_seconds_avg');
      expect(metricsRes.text).toContain('active_connections');
    });
  });
});
