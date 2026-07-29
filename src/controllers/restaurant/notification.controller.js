const NotificationService = require('../../services/restaurant/notification.service');
const { getPublicKey } = require('../../utils/webPush');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');

class NotificationController {
  /**
   * GET /api/v1/notifications
   * Get paginated active notifications
   */
  getNotifications = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const userId = req.user._id;
    const role = req.staff?.role || req.user?.role || 'staff';
    const { page, limit, type, unreadOnly } = req.query;

    const data = await NotificationService.getNotifications(restaurantId, userId, role, {
      page,
      limit,
      type,
      unreadOnly: unreadOnly === 'true',
    });

    return sendSuccess(res, 200, 'Active notifications retrieved successfully', data);
  });

  /**
   * GET /api/v1/notifications/unread-count
   * Fast endpoint for unread badge count
   */
  getUnreadCount = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const userId = req.user._id;
    const role = req.staff?.role || req.user?.role || 'staff';

    const unreadCount = await NotificationService.getUnreadCount(restaurantId, userId, role);

    return sendSuccess(res, 200, 'Unread count fetched', { unreadCount });
  });

  /**
   * DELETE /api/v1/notifications/:id
   * Dismiss single notification (auto-dismiss when clicked/handled)
   */
  dismissNotification = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const userId = req.user._id;
    const { id } = req.params;

    const result = await NotificationService.dismissNotification(restaurantId, userId, id);
    return sendSuccess(res, 200, 'Notification dismissed from inbox', result);
  });

  /**
   * DELETE /api/v1/notifications
   * Clear/dismiss all active notifications
   */
  dismissAllNotifications = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const userId = req.user._id;
    const role = req.staff?.role || req.user?.role || 'staff';

    const result = await NotificationService.dismissAllNotifications(restaurantId, userId, role);
    return sendSuccess(res, 200, 'All active notifications cleared', result);
  });

  /**
   * PATCH /api/v1/notifications/read
   * Mark array of notification IDs as read
   */
  markAsRead = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const userId = req.user._id;
    const { notificationIds } = req.body;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return sendError(res, 400, 'Array of notificationIds is required');
    }

    const result = await NotificationService.markAsRead(restaurantId, userId, notificationIds);
    return sendSuccess(res, 200, 'Notifications marked as read', result);
  });

  /**
   * PATCH /api/v1/notifications/read-all
   * Mark all notifications as read for current user
   */
  markAllAsRead = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const userId = req.user._id;
    const role = req.staff?.role || req.user?.role || 'staff';

    const result = await NotificationService.markAllAsRead(restaurantId, userId, role);
    return sendSuccess(res, 200, 'All notifications marked as read', result);
  });

  /**
   * GET /api/v1/notifications/vapid-key
   * Returns public VAPID key for browser Web Push subscription
   */
  getVapidKey = asyncHandler(async (req, res) => {
    const publicKey = getPublicKey();
    return sendSuccess(res, 200, 'VAPID public key retrieved', { publicKey });
  });

  /**
   * POST /api/v1/notifications/subscribe-push
   * Save Web Push subscription details for current browser session
   */
  subscribePush = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const userId = req.user._id;
    const role = req.staff?.role || req.user?.role || 'staff';
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return sendError(res, 400, 'Invalid web push subscription object');
    }

    const userAgent = req.headers['user-agent'] || '';
    const sub = await NotificationService.subscribeWebPush(userId, restaurantId, role, subscription, userAgent);

    return sendSuccess(res, 201, 'Web push subscription saved successfully', { id: sub._id });
  });
}

module.exports = new NotificationController();
