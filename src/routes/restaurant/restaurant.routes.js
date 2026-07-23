const express = require('express');
const multer = require('multer');
const RestaurantController = require('../../controllers/restaurant/restaurant.controller');
const validate = require('../../middlewares/validate');
const { protect, resolveTenant, restrictToRoles } = require('../../middlewares/auth');
const { updateRestaurantProfileSchema } = require('../../validators/restaurant.validator');

// Multer config for cover photo uploads
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

// Require tenant staff authentication
router.use(protect);
router.use(resolveTenant);

// 1. Fetch details
router.get('/profile', RestaurantController.getRestaurantDetails);

// 2. Update profile
router.patch(
  '/profile',
  restrictToRoles('owner', 'manager'),
  validate(updateRestaurantProfileSchema),
  RestaurantController.updateRestaurantProfile
);

// 3. Upload image
router.post(
  '/profile/image',
  restrictToRoles('owner'),
  upload.single('image'),
  RestaurantController.uploadRestaurantImage
);

// 4. Legal & Bank Amendment Requests (Owner submitted, Staff viewable)
router.post(
  '/legal-request',
  restrictToRoles('owner'),
  RestaurantController.submitLegalRequest
);

router.get(
  '/legal-requests',
  restrictToRoles('owner', 'manager'),
  RestaurantController.getLegalRequests
);

// 5. Toggle Restaurant Operational Status (Open / Closed)
router.patch(
  '/status',
  restrictToRoles('owner', 'manager'),
  RestaurantController.toggleRestaurantStatus
);

module.exports = router;
