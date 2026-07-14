const express = require('express');
const FeedbackController = require('../controllers/feedback.controller');
const validate = require('../middlewares/validate');
const { protect, resolveTenant, restrictToRoles } = require('../middlewares/auth');
const {
  createFeedbackSchema,
  resolveComplaintSchema,
} = require('../validators/feedback.validator');

const router = express.Router();

// 1. PUBLIC ENDPOINT: Submit feedback/review
router.post(
  '/',
  validate(createFeedbackSchema),
  FeedbackController.createFeedback
);

// 2. STAFF PROTECTED ENDPOINTS
router.use(protect);
router.use(resolveTenant);

// Query Feedbacks (Owners, Managers, Chefs, and Servers allowed to read comments)
router.get(
  '/',
  restrictToRoles('owner', 'manager', 'chef', 'server'),
  FeedbackController.getFeedbacks
);

// Analytics Dashboard (restricted to Owner and Manager roles)
router.get(
  '/analytics',
  restrictToRoles('owner', 'manager'),
  FeedbackController.getFeedbackAnalytics
);

// Resolve Complaint (restricted to Owner and Manager roles)
router.patch(
  '/:id/resolve',
  restrictToRoles('owner', 'manager'),
  validate(resolveComplaintSchema),
  FeedbackController.resolveComplaint
);

// Sync external platform reviews (restricted to Owner and Manager roles)
router.post(
  '/sync/:platform',
  restrictToRoles('owner', 'manager'),
  FeedbackController.syncExternalReviews
);

module.exports = router;
