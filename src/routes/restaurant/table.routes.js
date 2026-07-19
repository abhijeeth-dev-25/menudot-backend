const express = require('express');
const TableController = require('../../controllers/restaurant/table.controller');
const validate = require('../../middlewares/validate');
const { protect, resolveTenant } = require('../../middlewares/auth');
const {
  createTableSchema,
  updateTableSchema,
  toggleQrSchema,
  customerScanSchema,
  serviceCallSchema,
  placeDineInOrderSchema,
} = require('../../validators/table.validator');

const router = express.Router();

// ==========================================
// PUBLIC CUSTOMER ENDPOINTS (No Auth Required)
// ==========================================
router.post('/scan', validate(customerScanSchema), TableController.processCustomerScan);
router.post('/call', validate(serviceCallSchema), TableController.triggerServiceCall);
router.post('/order', validate(placeDineInOrderSchema), TableController.placeDineInOrder);
router.get('/order/:orderId', TableController.getCustomerOrder);

// ==========================================
// PROTECTED STAFF ENDPOINTS (Requires Auth & x-restaurant-id)
// ==========================================
router.use(protect);
router.use(resolveTenant);

router.post('/', validate(createTableSchema), TableController.createTable);
router.get('/', TableController.getTables);
router.put('/:tableId', validate(updateTableSchema), TableController.updateTable);
router.delete('/:tableId', TableController.deleteTable);
router.patch('/:tableId/qr/toggle', validate(toggleQrSchema), TableController.toggleQrCode);
router.post('/:tableId/checkout', TableController.checkoutTable);

module.exports = router;
