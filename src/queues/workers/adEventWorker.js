const queueManager = require('../queueManager');
const logger = require('../../utils/logger');

/**
 * Worker handler for ad tracking events (impressions/clicks).
 */
async function processAdEventJob(payload) {
  const { token, eventType } = payload;
  const AdService = require('../../services/platform/ad.service');
  const result = await AdService.trackEvent(token, eventType);
  logger.info({ token, eventType, result }, 'Ad event worker: Processed event tracking asynchronously');
  return result;
}

/**
 * Enqueues ad event tracking job.
 */
async function enqueueAdEventJob(payload) {
  return queueManager.enqueue('ad_event', 'TRACK_AD_EVENT', payload, processAdEventJob);
}

module.exports = {
  processAdEventJob,
  enqueueAdEventJob,
};
