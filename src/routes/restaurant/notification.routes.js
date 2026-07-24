const express = require('express');
const NotificationController = require('../../controllers/restaurant/notification.controller');
const { protect, resolveTenant } = require('../../middlewares/auth');

const router = express.Router();

// Public VAPID key endpoint
router.get('/vapid-key', NotificationController.getVapidKey);

// Protected routes
router.use(protect);
router.use(resolveTenant);

router.get('/', NotificationController.getNotifications);
router.get('/unread-count', NotificationController.getUnreadCount);
router.delete('/:id', NotificationController.dismissNotification);
router.delete('/', NotificationController.dismissAllNotifications);
router.patch('/read', NotificationController.markAsRead);
router.patch('/read-all', NotificationController.markAllAsRead);
router.post('/subscribe-push', NotificationController.subscribePush);

module.exports = router;
