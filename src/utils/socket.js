const { Server } = require('socket.io');
const { verifyAccessToken } = require('./jwt.util');
const Screen = require('../models/screen.model');
const Notification = require('../models/notification.model');
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
      const tableId = socket.handshake.query?.tableId;
      socket.auth = { type: 'customer', id: 'public-client', role: 'customer' };
      if (restaurantId) socket.restaurantId = restaurantId;
      if (tableId) socket.tableId = tableId;
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
        socket.screenDetails = {
          id: screen._id.toString(),
          name: screen.name,
          screenType: screen.screenType,
          allowedServices: screen.allowedServices || [],
          allowedTables: screen.allowedTables || [],
        };
        socket.restaurantId = screen.restaurantId.toString();
        socket.role = screen.screenType || 'screen';
      } else if (decoded.type === 'user') {
        const queryRestaurantId = socket.handshake.query?.restaurantId;
        if (queryRestaurantId) {
          socket.restaurantId = queryRestaurantId;
        }
        socket.userId = decoded.id;
        socket.role = decoded.role || 'staff';
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
        role: socket.role,
      },
      'Client socket connected successfully'
    );

    // 1. Join main restaurant tenant room
    if (socket.restaurantId) {
      socket.join(`restaurant_${socket.restaurantId}`);
      
      // 2. Join role-specific subroom
      if (socket.role) {
        socket.join(`restaurant_${socket.restaurantId}:role:${socket.role}`);
      }

      // 3. Join user room
      if (socket.userId) {
        socket.join(`user_${socket.userId}`);
      }

      // 4. Join screen room
      if (socket.screenDetails?.id) {
        socket.join(`screen_${socket.screenDetails.id}`);
      }
    }

    if (socket.tableId) {
      socket.join(`table_${socket.tableId}`);
    }

    // Dynamic join event for users who switch restaurants in their dashboard
    socket.on('join_restaurant', (data) => {
      const { restaurantId } = data;
      if (restaurantId) {
        if (socket.restaurantId && socket.restaurantId !== restaurantId) {
          socket.leave(`restaurant_${socket.restaurantId}`);
          if (socket.role) {
            socket.leave(`restaurant_${socket.restaurantId}:role:${socket.role}`);
          }
        }
        socket.restaurantId = restaurantId;
        socket.join(`restaurant_${restaurantId}`);
        if (socket.role) {
          socket.join(`restaurant_${restaurantId}:role:${socket.role}`);
        }
        logger.info({ socketId: socket.id, restaurantId }, 'Client switched/joined restaurant room');
      }
    });

    // Client reconnection sync (fetch missed notifications)
    socket.on('sync_missed_notifications', async (data, callback) => {
      try {
        const { lastSyncTime } = data || {};
        if (!socket.restaurantId) return;

        const query = {
          restaurantId: socket.restaurantId,
          createdAt: { $gte: new Date(lastSyncTime || Date.now() - 24 * 60 * 60 * 1000) },
          $or: [
            { targetType: 'all' },
            { targetType: 'role', targetId: socket.role },
            { targetType: 'user', targetId: socket.userId },
            { targetType: 'screen', targetId: socket.screenDetails?.id },
          ],
        };

        const missed = await Notification.find(query)
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();

        if (typeof callback === 'function') {
          callback({ success: true, notifications: missed });
        }
      } catch (err) {
        logger.error({ err }, 'Error syncing missed notifications');
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message });
        }
      }
    });

    // Client delivery ACK
    socket.on('notification_ack', async (data) => {
      try {
        const { notificationId } = data || {};
        if (notificationId) {
          await Notification.findByIdAndUpdate(notificationId, { deliveryStatus: 'delivered' });
        }
      } catch (err) {
        logger.warn({ err }, 'Notification ACK update error');
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
 * Emits an event directly to a table-specific room.
 * Used for customer-targeted events (e.g. table:qr_unlocked).
 */
function emitToTable(tableId, event, data) {
  if (!io) return;
  io.to(`table_${tableId}`).emit(event, data);
}

/**
 * Emits a structured notification to specific target rooms based on targetType.
 */
function emitNotification(notification) {
  if (!io) return;

  const { restaurantId, targetType, targetId } = notification;

  if (targetType === 'all') {
    io.to(`restaurant_${restaurantId}`).emit('notification_received', notification);
  } else if (targetType === 'role') {
    io.to(`restaurant_${restaurantId}:role:${targetId}`).emit('notification_received', notification);
  } else if (targetType === 'user') {
    io.to(`user_${targetId}`).emit('notification_received', notification);
  } else if (targetType === 'screen') {
    io.to(`screen_${targetId}`).emit('notification_received', notification);
  }
}

/**
 * Advanced production-grade notification router for table calls (services).
 */
function sendServiceCallNotification(restaurantId, tableNumber, serviceType, notificationPayload) {
  if (!io) return;

  logger.info(
    { restaurantId, tableNumber, serviceType },
    'Routing service call to authorized screen terminals'
  );

  for (const socket of connectedSockets) {
    if (socket.restaurantId !== restaurantId.toString()) {
      continue;
    }

    if (socket.screenDetails) {
      const { allowedServices, allowedTables } = socket.screenDetails;

      if (allowedServices.length > 0 && !allowedServices.includes(serviceType)) {
        continue;
      }

      if (allowedTables.length > 0 && !allowedTables.includes(tableNumber)) {
        continue;
      }
    }

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
  emitToTable,
  sendServiceCallNotification,
  emitNotification,
};
