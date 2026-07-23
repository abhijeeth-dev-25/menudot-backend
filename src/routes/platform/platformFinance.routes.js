const express = require('express');
const PlatformFinanceController = require('../../controllers/platform/platformFinance.controller');
const { protect } = require('../../middlewares/auth');
const { restrictToPlatformPermission } = require('../../middlewares/platformAuth');
const { PLATFORM_PERMISSIONS } = require('../../config/platformPermissions');

const router = express.Router();

// Require authenticated platform admin / super admin
router.use(protect);

// 1. Platform Financial Overview
router.get(
  '/overview',
  restrictToPlatformPermission(PLATFORM_PERMISSIONS.VIEW_FINANCIAL_REPORTS),
  PlatformFinanceController.getFinancialOverview
);

// 2. Global Payment Transaction Ledger
router.get(
  '/transactions',
  restrictToPlatformPermission(PLATFORM_PERMISSIONS.VIEW_FINANCIAL_REPORTS),
  PlatformFinanceController.getTransactionLedger
);

// 3. Disburse Merchant Bank Payout
router.post(
  '/settlements/:restaurantId/disburse',
  restrictToPlatformPermission(PLATFORM_PERMISSIONS.MANAGE_PAYOUTS),
  PlatformFinanceController.disburseSettlement
);

// 4. Update Restaurant SaaS Subscription Tier / Trial Extension
router.patch(
  '/subscriptions/:restaurantId',
  restrictToPlatformPermission(PLATFORM_PERMISSIONS.MANAGE_PLANS),
  PlatformFinanceController.updateSubscription
);

module.exports = router;
