const Notification = require('../../models/notification.model');
const PushSubscription = require('../../models/pushSubscription.model');
const queueManager = require('../../queues/queueManager');
const socketUtil = require('../../utils/socket');
const webPushUtil = require('../../utils/webPush');
const { getRedisClient, isConnected } = require('../../database/redis');
const logger = require('../../utils/logger');

class NotificationService {
  /**
   * Helper to derive default destination actionUrl based on notification type
   */
  getDefaultActionUrl(type, data = {}) {
    switch (type) {
      case 'ORDER_CREATED':
      case 'ORDER_STATUS_CHANGED':
      case 'KITCHEN_DELAY':
        return '/dashboard/orders'
      case 'SERVICE_CALL':
        return '/dashboard/tables'
      case 'STOCK_ALERT':
        return '/dashboard/raw-materials'
      case 'PAYMENT_RECEIVED':
        return '/dashboard/finance'
      default:
        return ''
    }
  }

  /**
   * Fast, non-blocking ingestion of notification events (<3ms producer latency).
   * Enqueues job to Redis queue for background worker execution.
   */
  async publish(payload) {
    const {
      restaurantId,
      targetType = 'all',
      targetId = null,
      type,
      title,
      message,
      actionUrl,
      priority = 'normal',
      data = {},
      dedupKey = null,
    } = payload;

    if (!restaurantId || !type || !title || !message) {
      throw new Error('Missing required notification fields: restaurantId, type, title, message');
    }

    const resolvedActionUrl = actionUrl || this.getDefaultActionUrl(type, data);
    const queueName = priority === 'high' || priority === 'urgent' ? 'notifications:high' : 'notifications:normal';

    const jobPayload = {
      restaurantId,
      targetType,
      targetId,
      type,
      title,
      message,
      actionUrl: resolvedActionUrl,
      priority,
      data,
      dedupKey,
      createdAt: new Date(),
    };

    return await queueManager.enqueue(
      queueName,
      `send_${type}`,
      jobPayload,
      (job) => this.processNotification(job)
    );
  }

  /**
   * Worker handler that processes enqueued notification jobs.
   * Performs deduplication, MongoDB persistence, Socket.io broadcast, and Web Push dispatch.
   */
  async processNotification(jobPayload) {
    const {
      restaurantId,
      targetType,
      targetId,
      type,
      title,
      message,
      actionUrl,
      priority,
      data,
      dedupKey,
    } = jobPayload;

    try {
      // 1. Sliding Window Deduplication check (if dedupKey provided)
      if (dedupKey && isConnected()) {
        const redisClient = getRedisClient();
        const dedupCacheKey = `dedup:${restaurantId}:${dedupKey}`;
        const isDuplicate = await redisClient.get(dedupCacheKey);
        if (isDuplicate) {
          logger.info({ restaurantId, dedupKey }, 'Throttled duplicate notification burst');
          return { status: 'throttled' };
        }
        await redisClient.set(dedupCacheKey, '1', { EX: 5 });
      }

      const resolvedActionUrl = actionUrl || this.getDefaultActionUrl(type, data);

      // 2. Persist to MongoDB database
      const notification = await Notification.create({
        restaurantId,
        targetType,
        targetId,
        type,
        title,
        message,
        actionUrl: resolvedActionUrl,
        priority,
        data,
        dedupKey,
        deliveryStatus: 'delivered',
      });

      const notificationDoc = notification.toObject();

      // 3. Dispatch real-time WebSocket broadcast via socket.js
      socketUtil.emitNotification(notificationDoc);

      if (type === 'SERVICE_CALL' && data?.tableNumber && data?.serviceType) {
        socketUtil.sendServiceCallNotification(restaurantId, data.tableNumber, data.serviceType, {
          notificationId: notificationDoc._id,
          title,
          message,
          data,
          actionUrl: resolvedActionUrl,
        });
      }

      // 4. Dispatch Web Push (VAPID) Notifications asynchronously
      this.dispatchWebPushNotifications(notificationDoc).catch((err) =>
        logger.error({ err }, 'Error dispatching web push notifications')
      );

      return { status: 'success', notificationId: notificationDoc._id };
    } catch (err) {
      logger.error({ err, jobPayload }, 'Failed to process notification worker job');
      throw err;
    }
  }

  /**
   * Dispatches Web Push notifications to subscribed browser sessions
   */
  async dispatchWebPushNotifications(notification) {
    const { restaurantId, targetType, targetId, title, message, type, priority, data, actionUrl } = notification;

    const query = { restaurantId };
    if (targetType === 'role') {
      query.role = targetId;
    } else if (targetType === 'user') {
      query.userId = targetId;
    }

    const subscriptions = await PushSubscription.find(query).lean();
    if (!subscriptions.length) return;

    const pushPayload = {
      title,
      body: message,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: `${type}_${restaurantId}`,
      data: {
        notificationId: notification._id,
        type,
        priority,
        actionUrl,
        ...data,
      },
    };

    const expiredEndpoints = [];
    await Promise.all(
      subscriptions.map(async (subDoc) => {
        const result = await webPushUtil.sendWebPush(subDoc.subscription, pushPayload);
        if (!result.success && result.expired) {
          expiredEndpoints.push(subDoc.subscription.endpoint);
        }
      })
    );

    if (expiredEndpoints.length > 0) {
      await PushSubscription.deleteMany({ 'subscription.endpoint': { $in: expiredEndpoints } });
    }
  }

  /**
   * Fetches paginated ACTIVE notifications (excluding dismissed alerts)
   */
  async getNotifications(restaurantId, userId, role, { page = 1, limit = 20, type, unreadOnly = false }) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const query = {
      restaurantId,
      'dismissedBy.userId': { $ne: userId }, // Exclude dismissed alerts
      $or: [
        { targetType: 'all' },
        { targetType: 'role', targetId: role },
        { targetType: 'user', targetId: userId },
      ],
    };

    if (type) {
      query.type = type;
    }

    if (unreadOnly) {
      query['readBy.userId'] = { $ne: userId };
    }

    const [items, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Notification.countDocuments(query),
    ]);

    const formattedItems = items.map((item) => {
      const isRead = item.readBy ? item.readBy.some((r) => r.userId.toString() === userId.toString()) : false;
      return {
        ...item,
        isRead,
      };
    });

    const unreadCount = await this.getUnreadCount(restaurantId, userId, role);

    return {
      items: formattedItems,
      unreadCount,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Returns total count of active unread notifications for a user
   */
  async getUnreadCount(restaurantId, userId, role) {
    const query = {
      restaurantId,
      'dismissedBy.userId': { $ne: userId },
      'readBy.userId': { $ne: userId },
      $or: [
        { targetType: 'all' },
        { targetType: 'role', targetId: role },
        { targetType: 'user', targetId: userId },
      ],
    };

    return await Notification.countDocuments(query);
  }

  /**
   * Dismisses a single notification upon action/click (removes from active inbox)
   */
  async dismissNotification(restaurantId, userId, notificationId) {
    const result = await Notification.updateOne(
      {
        _id: notificationId,
        restaurantId,
        'dismissedBy.userId': { $ne: userId },
      },
      {
        $push: {
          readBy: { userId, readAt: new Date() },
          dismissedBy: { userId, dismissedAt: new Date() },
        },
      }
    );

    return { success: true, modifiedCount: result.modifiedCount };
  }

  /**
   * Dismisses all active notifications for user
   */
  async dismissAllNotifications(restaurantId, userId, role) {
    const activeNotifications = await Notification.find({
      restaurantId,
      'dismissedBy.userId': { $ne: userId },
      $or: [
        { targetType: 'all' },
        { targetType: 'role', targetId: role },
        { targetType: 'user', targetId: userId },
      ],
    }).select('_id');

    const ids = activeNotifications.map((n) => n._id);
    if (!ids.length) return { modifiedCount: 0 };

    const result = await Notification.updateMany(
      { _id: { $in: ids } },
      {
        $push: {
          readBy: { userId, readAt: new Date() },
          dismissedBy: { userId, dismissedAt: new Date() },
        },
      }
    );

    return { success: true, modifiedCount: result.modifiedCount };
  }

  /**
   * Marks specified notification IDs as read for user
   */
  async markAsRead(restaurantId, userId, notificationIds) {
    if (!Array.isArray(notificationIds) || !notificationIds.length) {
      return { modifiedCount: 0 };
    }

    const result = await Notification.updateMany(
      {
        _id: { $in: notificationIds },
        restaurantId,
        'readBy.userId': { $ne: userId },
      },
      {
        $push: { readBy: { userId, readAt: new Date() } },
      }
    );

    return { modifiedCount: result.modifiedCount };
  }

  /**
   * Marks all unread notifications as read for a user
   */
  async markAllAsRead(restaurantId, userId, role) {
    const unreadNotifications = await Notification.find({
      restaurantId,
      'dismissedBy.userId': { $ne: userId },
      'readBy.userId': { $ne: userId },
      $or: [
        { targetType: 'all' },
        { targetType: 'role', targetId: role },
        { targetType: 'user', targetId: userId },
      ],
    }).select('_id');

    const ids = unreadNotifications.map((n) => n._id);
    if (!ids.length) return { modifiedCount: 0 };

    return await this.markAsRead(restaurantId, userId, ids);
  }

  /**
   * Registers a browser VAPID push subscription
   */
  async subscribeWebPush(userId, restaurantId, role, subscription, userAgent = '') {
    return await PushSubscription.findOneAndUpdate(
      { 'subscription.endpoint': subscription.endpoint },
      {
        userId,
        restaurantId,
        role: role || 'staff',
        subscription,
        userAgent,
      },
      { upsert: true, new: true }
    );
  }
}

module.exports = new NotificationService();
