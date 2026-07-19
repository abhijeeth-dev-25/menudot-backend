const express = require('express');
const RestaurantController = require('../../controllers/platform/restaurant.controller');
const VerificationController = require('../../controllers/platform/verification.controller');
const validate = require('../../middlewares/validate');
const { protect } = require('../../middlewares/auth');
const { restrictToPlatformPermission } = require('../../middlewares/platformAuth');
const { PLATFORM_PERMISSIONS } = require('../../config/platformPermissions');
const { onboardingReviewSchema } = require('../../validators/restaurant.validator');

const router = express.Router();

// All platform restaurant routes require platform user login
router.use(protect);

// --- Verification Team Scope ---
// 1. Pending document verifications queue
router.get(
  '/verification/pending',
  restrictToPlatformPermission(PLATFORM_PERMISSIONS.VERIFY_RESTAURANT_DOCS),
  VerificationController.getPendingVerifications
);

// 2. Toggle verify a specific document
router.post(
  '/onboarding/:restaurantId/verify',
  restrictToPlatformPermission(PLATFORM_PERMISSIONS.VERIFY_RESTAURANT_DOCS),
  VerificationController.verifyDocument
);

// 1. Pending onboardings queue
router.get(
  '/onboarding/pending',
  restrictToPlatformPermission(PLATFORM_PERMISSIONS.VIEW_SYSTEM_REPORTS),
  RestaurantController.getPendingOnboardings
);

// 2. Review (approve/reject) onboarding
router.post(
  '/onboarding/:restaurantId/review',
  restrictToPlatformPermission(PLATFORM_PERMISSIONS.APPROVE_RESTAURANT),
  validate(onboardingReviewSchema),
  RestaurantController.reviewOnboarding
);

// 3. List all restaurants
router.get(
  '/',
  restrictToPlatformPermission(PLATFORM_PERMISSIONS.VIEW_SYSTEM_REPORTS),
  RestaurantController.getRestaurants
);

// 4. Soft delete restaurant
router.delete(
  '/:id',
  restrictToPlatformPermission(PLATFORM_PERMISSIONS.SUSPEND_RESTAURANT),
  RestaurantController.deleteRestaurantAdmin
);

module.exports = router;
