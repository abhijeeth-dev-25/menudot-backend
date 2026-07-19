const express = require('express');
const SystemController = require('../../controllers/platform/system.controller');
const { protect } = require('../../middlewares/auth');
const { restrictToPlatformPermission } = require('../../middlewares/platformAuth');
const { PLATFORM_PERMISSIONS } = require('../../config/platformPermissions');

const router = express.Router();

// Require login
router.use(protect);

// 1. Database stats
router.get(
  '/stats',
  restrictToPlatformPermission(PLATFORM_PERMISSIONS.ACCESS_DB_TOOLS),
  SystemController.getDatabaseStats
);

// 2. Emergency controls
router.post(
  '/emergency',
  restrictToPlatformPermission(PLATFORM_PERMISSIONS.EMERGENCY_CONTROLS),
  SystemController.toggleEmergencyControl
);

// 3. Create platform users (manage staff/admins)
router.post(
  '/users',
  restrictToPlatformPermission(PLATFORM_PERMISSIONS.MANAGE_PLATFORM_ADMINS),
  SystemController.createPlatformUser
);

module.exports = router;
