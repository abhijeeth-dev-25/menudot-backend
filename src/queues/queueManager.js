const logger = require('../utils/logger');
const { getRedisClient, isConnected } = require('../database/redis');

class QueueManager {
  constructor() {
    this.inMemoryJobs = [];
  }

  /**
   * Enqueues a job for background processing.
   * Uses Redis if connected; otherwise falls back to immediate async execution.
   * 
   * @param {string} queueName - Name of queue ('email', 'ad_event', 'webhook')
   * @param {string} jobName - Descriptive job name
   * @param {object} payload - Job data payload
   * @param {function} handler - Async worker function to process the job payload
   */
  async enqueue(queueName, jobName, payload, handler) {
    if (isConnected()) {
      try {
        const redisClient = getRedisClient();
        const jobId = `job:${queueName}:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const jobData = JSON.stringify({ queueName, jobName, payload, createdAt: new Date() });
        await redisClient.lPush(`queue:${queueName}`, jobData);
        logger.info({ queueName, jobName, jobId }, 'Enqueued job tracking in Redis');
      } catch (err) {
        logger.warn({ err, queueName, jobName }, 'Redis tracking enqueue failed');
      }
    }

    // Asynchronous non-blocking execution of background job
    setImmediate(async () => {
      try {
        await handler(payload);
        logger.info({ queueName, jobName }, 'Processed background job successfully');
      } catch (err) {
        logger.error({ err, queueName, jobName }, 'Error processing background job');
      }
    });

    return { jobId: `job_${Date.now()}`, status: 'processed_async' };
  }
}

module.exports = new QueueManager();
