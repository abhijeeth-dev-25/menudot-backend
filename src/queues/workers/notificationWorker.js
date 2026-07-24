const NotificationService = require('../../services/restaurant/notification.service');
const logger = require('../../utils/logger');

/**
 * Worker process for handling notification jobs from Redis queues.
 */
async function processNotificationJob(payload) {
  try {
    const result = await NotificationService.processNotification(payload);
    logger.info({ result, type: payload.type }, 'Notification worker: Job processed successfully');
    return result;
  } catch (err) {
    logger.error({ err, payload }, 'Notification worker: Job execution failed');
    throw err;
  }
}

module.exports = {
  processNotificationJob,
};
