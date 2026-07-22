const redis = require('redis');
const logger = require('../utils/logger');
const config = require('../config/env');

let redisClient = null;
let isConnected = false;

/**
 * Initializes Redis client and attempts connection.
 * Resilient against network drops and starts up gracefully.
 */
async function connectRedis() {
  if (redisClient) return redisClient;

  redisClient = redis.createClient({
    url: config.redis?.url || 'redis://localhost:6379',
  });

  redisClient.on('error', (err) => {
    logger.warn({ err }, 'Redis Connection Error - fallback active');
    isConnected = false;
  });

  redisClient.on('connect', () => {
    logger.info('Redis connected successfully');
    isConnected = true;
  });

  redisClient.on('end', () => {
    logger.warn('Redis connection closed');
    isConnected = false;
  });

  try {
    await redisClient.connect();
  } catch (error) {
    logger.warn({ err: error }, 'Redis initial connection failed - fallback active');
    isConnected = false;
  }

  return redisClient;
}

function getRedisClient() {
  return redisClient;
}

async function disconnectRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (e) {
      // ignore connection quit errors
    }
    redisClient = null;
    isConnected = false;
    logger.info('Redis connection closed successfully');
  }
}

/**
 * Executes a Redis operation safely.
 * Fallback values are automatically returned if Redis is unavailable.
 *
 * @param {Function} fn Function executing Redis commands
 * @param {*} fallbackValue Fallback if Redis fails
 */
async function safeRedisCall(fn, fallbackValue = null) {
  if (!redisClient || !isConnected) {
    return fallbackValue;
  }

  try {
    return await fn(redisClient);
  } catch (error) {
    logger.warn({ err: error }, 'Redis command execution failed - falling back');
    return fallbackValue;
  }
}

module.exports = {
  connectRedis,
  getRedisClient,
  disconnectRedis,
  safeRedisCall,
  isConnected: () => isConnected,
};
