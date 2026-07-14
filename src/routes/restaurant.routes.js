const express = require('express');
const multer = require('multer');
const RestaurantController = require('../controllers/restaurant.controller');
const validate = require('../middlewares/validate');
const { protect, resolveTenant, restrictToGlobalRole, restrictToRoles } = require('../middlewares/auth');
const { onboardingReviewSchema, updateRestaurantProfileSchema } = require('../validators/restaurant.validator');

// Multer: memory storage, 5MB limit, image-only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Invalid file type. Only JPG, PNG, and WebP are accepted.'));
  },
});

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

// Update restaurant profile (requires Owner/Manager role, via resolveTenant)
router.patch(
  '/profile',
  resolveTenant,
  restrictToRoles('owner', 'manager'),
  validate(updateRestaurantProfileSchema),
  RestaurantController.updateRestaurantProfile
);

// Upload restaurant cover image (Owner only)
router.post(
  '/profile/image',
  resolveTenant,
  restrictToRoles('owner'),
  upload.single('image'),
  RestaurantController.uploadRestaurantImage
);

// Admin account deletion (Platform Admins / Developers only)
router.delete(
  '/admin/:id',
  restrictToGlobalRole('platform_admin'),
  RestaurantController.deleteRestaurantAdmin
);

module.exports = router;
