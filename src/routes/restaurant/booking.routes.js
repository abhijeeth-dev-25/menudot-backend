const express = require('express');
const BookingController = require('../../controllers/restaurant/booking.controller');
const validate = require('../../middlewares/validate');
const { protect, resolveTenant, restrictToRoles } = require('../../middlewares/auth');
const { createBookingSchema, updateBookingSchema } = require('../../validators/booking.validator');

const router = express.Router();

// ==========================================
// PUBLIC CUSTOMER ENDPOINTS (No Auth Required)
// ==========================================
// Customer table reservation creation
router.post('/', validate(createBookingSchema), BookingController.createBooking);

// Dineout webhook reservation sync
router.post('/webhooks/dineout/:platform', BookingController.handleDineoutWebhook);

// ==========================================
// PROTECTED STAFF ENDPOINTS (Requires Auth & Tenant Resolution)
// ==========================================
router.get(
  '/',
  protect,
  resolveTenant,
  restrictToRoles('owner', 'manager', 'server', 'chef'),
  BookingController.getBookings
);

router.patch(
  '/:id',
  protect,
  resolveTenant,
  restrictToRoles('owner', 'manager', 'server'),
  validate(updateBookingSchema),
  BookingController.updateBooking
);

module.exports = router;
