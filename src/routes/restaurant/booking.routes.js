const express = require('express');
const BookingController = require('../../controllers/restaurant/booking.controller');
const validate = require('../../middlewares/validate');
const { protect, resolveTenant, restrictToRoles } = require('../../middlewares/auth');
const {
  createBookingSchema,
  anonymousBookingSchema,
  verifyBookingPaymentSchema,
  redeemCouponSchema,
  updateBookingSchema,
  walkinTableSchema,
} = require('../../validators/booking.validator');

const router = express.Router();

// ==========================================
// PUBLIC ANONYMOUS CUSTOMER ENDPOINTS (No Auth Required)
// ==========================================
// 1. Anonymous Web Slot Booking (calculates ₹20/guest pre-booking fee & payment order)
router.post('/public/create', validate(anonymousBookingSchema), BookingController.createAnonymousBooking);

// 2. Verify Booking Payment & Send Confirmation Email with Coupon Code
router.post('/public/verify-payment', validate(verifyBookingPaymentSchema), BookingController.verifyAnonymousBookingPayment);

// 3. Customer table reservation creation (Direct)
router.post('/', validate(createBookingSchema), BookingController.createBooking);

// 4. Dineout webhook reservation sync
router.post('/webhooks/dineout/:platform', BookingController.handleDineoutWebhook);

// ==========================================
// PROTECTED STAFF ENDPOINTS (Requires Auth & Tenant Resolution)
// ==========================================
// 5. Staff Verify Coupon Code & Assign Table
router.post(
  '/verify-coupon',
  protect,
  resolveTenant,
  restrictToRoles('owner', 'manager', 'server'),
  validate(redeemCouponSchema),
  BookingController.verifyAndRedeemCoupon
);

// 6. Real-Time Walk-In Guest Table Availability Finder (Prevents double booking pre-booked slots)
router.get(
  '/tables/available-for-walkin',
  protect,
  resolveTenant,
  restrictToRoles('owner', 'manager', 'server'),
  validate(walkinTableSchema, 'query'),
  BookingController.getAvailableTablesForWalkIn
);

// 7. Get All Reservations & History
router.get(
  '/',
  protect,
  resolveTenant,
  restrictToRoles('owner', 'manager', 'server', 'chef'),
  BookingController.getBookings
);

// 8. Staff History endpoint alias
router.get(
  '/staff/history',
  protect,
  resolveTenant,
  restrictToRoles('owner', 'manager', 'server', 'chef'),
  BookingController.getBookings
);

// 9. Update Reservation
router.patch(
  '/:id',
  protect,
  resolveTenant,
  restrictToRoles('owner', 'manager', 'server'),
  validate(updateBookingSchema),
  BookingController.updateBooking
);

module.exports = router;
