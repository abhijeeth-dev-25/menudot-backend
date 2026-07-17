const express = require('express');
const OrderController = require('../controllers/order.controller');
const validate = require('../middlewares/validate');
const { protect, resolveTenant, restrictToRoles } = require('../middlewares/auth');
const { updateStatusSchema } = require('../validators/order.validator');

const router = express.Router();

// Order management endpoints require authentication and tenant mapping
router.use(protect);
router.use(resolveTenant);

// Get orders queue
router.get('/', OrderController.getOrders);

// Only owners, managers, and chefs can modify order preparation statuses
router.patch(
  '/:orderId/status',
  restrictToRoles('owner', 'manager', 'chef'),
  validate(updateStatusSchema),
  OrderController.updateOrderStatus
);

module.exports = router;
