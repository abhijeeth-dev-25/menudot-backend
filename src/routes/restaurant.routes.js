const express = require('express');
const RestaurantController = require('../controllers/restaurant.controller');
const validate = require('../middlewares/validate');
const { protect, resolveTenant, restrictToGlobalRole } = require('../middlewares/auth');
const { onboardingReviewSchema } = require('../validators/restaurant.validator');

const router = express.Router();

// All restaurant routes require authentication
router.use(protect);

// Admin list pending applications
router.get(
  '/onboarding/pending',
  restrictToGlobalRole('platform_admin'),
  RestaurantController.getPendingOnboardings
);

// Admin review onboarding application
router.post(
  '/onboarding/:restaurantId/review',
  restrictToGlobalRole('platform_admin'),
  validate(onboardingReviewSchema),
  RestaurantController.reviewOnboarding
);

// Fetch logged-in user's restaurant details (requires X-Restaurant-ID header)
router.get('/profile', resolveTenant, RestaurantController.getRestaurantDetails);

module.exports = router;
