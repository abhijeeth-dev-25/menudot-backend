const express = require('express');
const InventoryController = require('../../controllers/restaurant/inventory.controller');
const validate = require('../../middlewares/validate');
const { protect, resolveTenant, restrictToRoles } = require('../../middlewares/auth');
const {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  adjustStockSchema,
} = require('../../validators/inventory.validator');

const router = express.Router();

// All inventory operations require authentication and tenant resolution
router.use(protect);
router.use(resolveTenant);

// GET listing available for owner, manager, and chef (who checks stock availability)
router.get(
  '/items',
  restrictToRoles('owner', 'manager', 'chef'),
  InventoryController.getInventoryItems
);

// Stock adjustments allowed for owner, manager, and chef
router.post(
  '/items/:id/adjust',
  restrictToRoles('owner', 'manager', 'chef'),
  validate(adjustStockSchema),
  InventoryController.adjustStock
);

// Creation and property updates restricted to owner and manager roles
router.post(
  '/items',
  restrictToRoles('owner', 'manager'),
  validate(createInventoryItemSchema),
  InventoryController.createInventoryItem
);

router.patch(
  '/items/:id',
  restrictToRoles('owner', 'manager'),
  validate(updateInventoryItemSchema),
  InventoryController.updateInventoryItem
);

module.exports = router;
