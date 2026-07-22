const app = require('./app');
const config = require('./config/env');
const { connectDB, disconnectDB } = require('./database/db');
const { connectRedis, disconnectRedis } = require('./database/redis');
const logger = require('./utils/logger');

let server;

/**
 * Boots the server: establishes database connection, starts listening on port.
 */
async function bootstrap() {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Connect to Redis (Graceful fallback wrapper)
    await connectRedis();

    // 3. Start listening
    server = app.listen(config.port, () => {
      logger.info(
        { port: config.port, env: config.env },
        'Server is running and listening on port'
      );
    });

    // 3. Initialize Socket.io real-time server
    const socketManager = require('./utils/socket');
    socketManager.init(server);
  } catch (err) {
    logger.fatal({ err }, 'Bootstrap sequence failed to start server');
    process.exit(1);
  }
}

// Start booting
bootstrap();

/**
 * Triggers clean graceful shutdown sequence.
 * Closes HTTP server first (rejecting new requests), then closes database connection.
 */
function gracefulShutdown(signal) {
  logger.info({ signal }, 'Graceful shutdown signal received');
  
  if (server) {
    logger.info('Closing HTTP server...');
    server.close(async () => {
      logger.info('HTTP server closed. Safe to close database connection.');
      
      // Close database connection
      await disconnectDB();
      await disconnectRedis();
      
      logger.info('Graceful shutdown completed successfully. Exiting.');
      process.exit(0);
    });
    
    // Safety fallback: Force termination if shutdown hangs (e.g. infinite loop/stuck sockets)
    setTimeout(() => {
      logger.fatal('Force terminating process because graceful shutdown timed out.');
      process.exit(1);
    }, 10000); // 10 seconds timeout limit
  } else {
    process.exit(0);
  }
}

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch unhandled exceptions and promise rejections
process.on('uncaughtException', (err) => {
  logger.fatal({ err: { message: err.message, stack: err.stack } }, 'Uncaught Exception detected! Node process terminating...');
  
  // Clean up and shutdown
  if (server) {
    server.close(async () => {
      await disconnectDB();
      await disconnectRedis();
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled Promise Rejection detected!');
  // In production, it's recommended to treat unhandled rejections as uncaughtExceptions and terminate
  throw reason;
});
