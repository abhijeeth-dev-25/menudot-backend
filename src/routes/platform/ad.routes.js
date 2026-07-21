const express = require('express');
const AdController = require('../../controllers/platform/ad.controller');
const { protect } = require('../../middlewares/auth');
const { restrictToPlatformPermission } = require('../../middlewares/platformAuth');
const { PLATFORM_PERMISSIONS } = require('../../config/platformPermissions');

const router = express.Router();

// --- PUBLIC AD ENDPOINTS (Accessed by QR clients, dash panels, etc.) ---
router.get('/serve', AdController.serveAd);
router.post('/events', AdController.trackEvent);

// --- SECURE AD OPERATIONS (Accessed by Growth/Sales or Platform Admins) ---
router.post(
  '/',
  protect,
  restrictToPlatformPermission(PLATFORM_PERMISSIONS.MANAGE_PLATFORM_ADS),
  AdController.createCampaign
);

module.exports = router;
