const express = require('express');
const BillController = require('../../controllers/restaurant/bill.controller');
const validate = require('../../middlewares/validate');
const { protect, resolveTenant, restrictToRoles } = require('../../middlewares/auth');
const {
  settleBillSchema,
  getBillHistorySchema,
} = require('../../validators/bill.validator');

const router = express.Router();

// Public customer endpoint (No Auth Required)
router.post('/public/table/generate', BillController.generateTableBillPublic);

// Protected staff & manager endpoints (Requires Auth & Tenant Scoping)
router.use(protect);
router.use(resolveTenant);

// 1. Generate or refresh unpaid table bill (with Dynamic Payment QR Code)
router.post(
  '/table/:tableId/generate',
  restrictToRoles('admin', 'manager', 'cashier', 'staff', 'owner', 'waiter', 'server'),
  BillController.generateTableBill
);

// 2. Settle bill (Full or Split Offline Cash/POS/UPI or Online)
router.post(
  '/:billId/settle',
  restrictToRoles('admin', 'manager', 'cashier', 'staff', 'owner', 'waiter', 'server'),
  validate(settleBillSchema),
  BillController.settleBill
);

// 3. Thermal print receipt HTML or ESC/POS print payload
router.get(
  '/:id/print',
  restrictToRoles('admin', 'manager', 'cashier', 'staff', 'owner', 'waiter', 'server'),
  BillController.getPrintableReceipt
);

// 4. Live bills & instant collection summary
router.get(
  '/live',
  restrictToRoles('admin', 'manager', 'cashier', 'staff', 'owner', 'waiter', 'server'),
  BillController.getLiveBills
);

// 5. Paginated bill history with filters
router.get(
  '/history',
  restrictToRoles('admin', 'manager', 'cashier', 'staff', 'owner', 'waiter', 'server'),
  validate(getBillHistorySchema, 'query'),
  BillController.getBillHistory
);

// 6. Get single bill details
router.get(
  '/:id',
  restrictToRoles('admin', 'manager', 'cashier', 'staff', 'owner', 'waiter', 'server'),
  BillController.getBillDetails
);

module.exports = router;
