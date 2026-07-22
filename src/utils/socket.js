const { Server } = require('socket.io');
const { verifyAccessToken } = require('./jwt.util');
const Screen = require('../models/screen.model');
const logger = require('./logger');

let io = null;
const connectedSockets = new Set();

/**
 * Initializes the Socket.io server on top of HTTP server.
 * 
 * @param {object} server - HTTP Server instance
 */
function init(server) {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow all client interfaces (POS, tablets, screens)
      methods: ['GET', 'POST'],
    },
  });

  // Authentication Middleware
  io.use(async (socket, next) => {
    const isCustomer = socket.handshake.query?.isCustomer === 'true';
    if (isCustomer) {
      const restaurantId = socket.handshake.query?.restaurantId;
      if (!restaurantId) {
        return next(new Error('Restaurant ID required for customer connections.'));
      }
      socket.auth = { type: 'customer', id: 'public-client', role: 'customer' };
      socket.restaurantId = restaurantId;
      return next();
    }

    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication token required.'));
    }

    try {
      const decoded = verifyAccessToken(token);
      socket.auth = decoded;

      // If it is a screen device connection, load its allowed services/tables settings
      if (decoded.type === 'screen') {
        const screen = await Screen.findById(decoded.id);
        if (!screen || screen.status !== 'active') {
          return next(new Error('Screen device is inactive or removed.'));
        }
        // Save settings directly on socket context for dynamic notifications routing
        socket.screenDetails = {
          id: screen._id,
          name: screen.name,
          screenType: screen.screenType,
          allowedServices: screen.allowedServices || [],
          allowedTables: screen.allowedTables || [],
        };
        socket.restaurantId = screen.restaurantId.toString();
      } else if (decoded.type === 'user') {
        // For standard users, they specify restaurantId in connection parameters
        const queryRestaurantId = socket.handshake.query?.restaurantId;
        if (queryRestaurantId) {
          socket.restaurantId = queryRestaurantId;
        }
      }

      next();
    } catch (err) {
      logger.warn({ err }, 'Socket connection authentication failed');
      return next(new Error('Authentication failed.'));
    }
  });

  io.on('connection', (socket) => {
    connectedSockets.add(socket);
    logger.info(
      {
        socketId: socket.id,
        type: socket.auth?.type,
        restaurantId: socket.restaurantId,
      },
      'Client socket connected successfully'
    );

    // Join tenant room if restaurantId is resolved during handshake
    if (socket.restaurantId) {
      socket.join(`restaurant_${socket.restaurantId}`);
      logger.info({ socketId: socket.id, room: `restaurant_${socket.restaurantId}` }, 'Joined tenant room');
    }

    // Dynamic join event for users who switch restaurants in their dashboard
    socket.on('join_restaurant', (data) => {
      const { restaurantId } = data;
      if (restaurantId) {
        // Leave old restaurant room if any
        if (socket.restaurantId && socket.restaurantId !== restaurantId) {
          socket.leave(`restaurant_${socket.restaurantId}`);
        }
        socket.restaurantId = restaurantId;
        socket.join(`restaurant_${restaurantId}`);
        logger.info({ socketId: socket.id, restaurantId }, 'Client switched/joined restaurant room');
      }
    });

    socket.on('disconnect', () => {
      connectedSockets.delete(socket);
      logger.info({ socketId: socket.id }, 'Client socket disconnected');
    });
  });

  return io;
}

/**
 * Broadcasts an event to all sockets in a restaurant room.
 */
function broadcastToRestaurant(restaurantId, event, data) {
  if (!io) return;
  io.to(`restaurant_${restaurantId}`).emit(event, data);
}

/**
 * Advanced production-grade notification router for table calls (services).
 * Filters notifications so they are only delivered to screens that are authorized
 * to listen for that specific service type and table number.
 * 
 * @param {string} restaurantId - Target restaurant
 * @param {string} tableNumber - Table requesting service (e.g. "T-1")
 * @param {string} serviceType - Service requested (e.g. "water", "bill")
 * @param {object} notificationPayload - Notification attributes
 */
function sendServiceCallNotification(restaurantId, tableNumber, serviceType, notificationPayload) {
  if (!io) return;

  const targetRoom = `restaurant_${restaurantId}`;
  logger.info(
    { restaurantId, tableNumber, serviceType },
    'Routing service call to authorized screen terminals'
  );

  // Loop through all active sockets to apply specific filters
  for (const socket of connectedSockets) {
    // 1. Enforce restaurant isolation
    if (socket.restaurantId !== restaurantId.toString()) {
      continue;
    }

    // 2. Enforce screen-specific service & table filters
    if (socket.screenDetails) {
      const { allowedServices, allowedTables } = socket.screenDetails;

      // Check if this screen blocks this service type (e.g. Chef KDS doesn't need Water alerts)
      if (allowedServices.length > 0 && !allowedServices.includes(serviceType)) {
        continue;
      }

      // Check if this screen is bound to specific tables (e.g. Waiter assigned to T-1 to T-5)
      if (allowedTables.length > 0 && !allowedTables.includes(tableNumber)) {
        continue;
      }
    }

    // 3. Emit notification directly to this socket
    socket.emit('service_call_received', {
      tableNumber,
      serviceType,
      ...notificationPayload,
    });
  }
}

module.exports = {
  init,
  broadcastToRestaurant,
  emitToRestaurantRoom: broadcastToRestaurant,
  sendServiceCallNotification,
};
