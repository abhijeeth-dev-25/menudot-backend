const express = require('express');
const OrderController = require('../../controllers/restaurant/order.controller');
const validate = require('../../middlewares/validate');
const { protect, resolveTenant, restrictToRoles } = require('../../middlewares/auth');
const { updateStatusSchema } = require('../../validators/order.validator');

const router = express.Router();

// Order management endpoints require authentication and tenant mapping
router.use(protect);
router.use(resolveTenant);

// Get orders queue
router.get('/', OrderController.getOrders);

// Allow owners, managers, chefs, waiters, and servers to modify order preparation statuses
router.patch(
  '/:orderId/status',
  restrictToRoles('owner', 'manager', 'chef', 'waiter', 'server'),
  validate(updateStatusSchema),
  OrderController.updateOrderStatus
);

module.exports = router;
