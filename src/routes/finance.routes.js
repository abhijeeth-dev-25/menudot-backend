const express = require('express');
const FinanceController = require('../controllers/finance.controller');
const validate = require('../middlewares/validate');
const { protect, resolveTenant, restrictToRoles } = require('../middlewares/auth');
const {
  createExpenseSchema,
  getPNLReportSchema,
  generateRollupSchema,
} = require('../validators/finance.validator');

const router = express.Router();

// All finance operations require authentication and tenant resolution
router.use(protect);
router.use(resolveTenant);

// Log and List Expenses (Owner and Manager roles allowed)
router.post(
  '/expenses',
  restrictToRoles('owner', 'manager'),
  validate(createExpenseSchema),
  FinanceController.recordExpense
);

router.get(
  '/expenses',
  restrictToRoles('owner', 'manager'),
  FinanceController.getExpenses
);

// Reports and Rollups restricted strictly to the Owner role for financial privacy
router.get(
  '/reports/pnl',
  restrictToRoles('owner'),
  validate(getPNLReportSchema, 'query'),
  FinanceController.getDailyReports
);

router.post(
  '/reports/pnl/generate',
  restrictToRoles('owner'),
  validate(generateRollupSchema),
  FinanceController.generateDailyFinanceReport
);

module.exports = router;
