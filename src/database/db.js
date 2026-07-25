const mongoose = require('mongoose');
const config = require('../config/env');
const logger = require('../utils/logger');

const RETRY_INTERVAL_MS = 5000;
let isShuttingDown = false;

/**
 * Mongoose database connection options.
 * Optimized for production multi-tenant pooling.
 */
const mongooseOptions = {
  maxPoolSize: 50,                // Maintain up to 50 socket connections
  minPoolSize: 10,                // Keep at least 10 socket connections open
  socketTimeoutMS: 45000,         // Close sockets after 45 seconds of inactivity
  serverSelectionTimeoutMS: 5000, // Timeout after 5s trying to reach server
  heartbeatFrequencyMS: 10000,    // Send heartbeat every 10s to keep connection alive
};

/**
 * Initializes connection to MongoDB.
 * Implements exponential backoff / retry logic for high availability.
 */
async function connectDB() {
  const dbUrl = config.mongoose.url;
  
  logger.info({ url: dbUrl.replace(/:([^@]+)@/, ':****@') }, 'Connecting to MongoDB...');

  try {
    await mongoose.connect(dbUrl, mongooseOptions);
  } catch (error) {
    logger.error({ err: error }, 'MongoDB initial connection failed. Retrying...');
    
    // Retry connection after interval if not shutting down
    if (!isShuttingDown) {
      setTimeout(connectDB, RETRY_INTERVAL_MS);
    }
  }
}

async function ensureFounderAccount() {
  try {
    const User = require('../models/user.model');
    const founderEmail = config.founder?.email;
    if (!founderEmail) return;

    let founder = await User.findOne({ email: founderEmail });
    if (!founder) {
      founder = new User({
        fullName: config.founder.name,
        email: founderEmail,
        mobile: config.founder.mobile,
        passwordHash: config.founder.initialPassword,
        globalRole: 'super_admin',
        status: 'active',
      });
      await founder.save();
      logger.info('Founder super_admin account verified & active');
    } else {
      const isMatch = await founder.isPasswordMatch(config.founder.initialPassword);
      if (!isMatch) {
        founder.passwordHash = config.founder.initialPassword;
        await founder.save();
        logger.info('Founder super_admin password verified & synchronized');
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to ensure Founder account auto-seed');
  }
}

// Connection Event Listeners
mongoose.connection.on('connected', async () => {
  logger.info('MongoDB connected successfully');
  await ensureFounderAccount();
});

mongoose.connection.on('error', (err) => {
  logger.error({ err }, 'MongoDB connection error encountered');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection disconnected');
  
  // Reconnection is handled automatically by Mongoose for temporary drops,
  // but if the initial connection failed, the retry loop above takes care of it.
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB connection reestablished');
});

/**
 * Returns database health status.
 * States: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting.
 * @returns {object} Health details
 */
function getDBHealth() {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    status: state === 1 ? 'healthy' : 'unhealthy',
    state: states[state] || 'unknown',
  };
}

/**
 * Gracefully shuts down the database connection during process exit.
 */
async function disconnectDB() {
  isShuttingDown = true;
  logger.info('Initiating database graceful shutdown...');
  
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed successfully');
  } catch (error) {
    logger.error({ err: error }, 'Error during MongoDB graceful shutdown');
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  getDBHealth,
};
