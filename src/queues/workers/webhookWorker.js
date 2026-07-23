const queueManager = require('../queueManager');
const logger = require('../../utils/logger');

/**
 * Worker handler for aggregator webhooks (Swiggy, Zomato, Magicpin).
 */
async function processWebhookJob(payload) {
  const { provider, eventType, data } = payload;
  logger.info({ provider, eventType }, 'Webhook worker: Processed aggregator payload asynchronously');
  return { provider, eventType, status: 'processed' };
}

/**
 * Enqueues aggregator webhook job.
 */
async function enqueueWebhookJob(payload) {
  return queueManager.enqueue('webhook', 'PROCESS_WEBHOOK', payload, processWebhookJob);
}

module.exports = {
  processWebhookJob,
  enqueueWebhookJob,
};
