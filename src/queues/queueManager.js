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
        logger.info({ queueName, jobName, jobId }, 'Enqueued job in Redis queue');
        return { jobId, status: 'enqueued_redis' };
      } catch (err) {
        logger.warn({ err, queueName, jobName }, 'Redis enqueue failed. Falling back to in-memory async execution');
      }
    }

    // Fallback: Asynchronous in-memory execution using setImmediate
    setImmediate(async () => {
      try {
        await handler(payload);
        logger.info({ queueName, jobName }, 'Processed job in-memory (async worker fallback)');
      } catch (err) {
        logger.error({ err, queueName, jobName }, 'Error processing in-memory background job');
      }
    });

    return { jobId: `mem_${Date.now()}`, status: 'processed_in_memory' };
  }
}

module.exports = new QueueManager();
