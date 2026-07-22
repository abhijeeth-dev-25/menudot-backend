const BookingService = require('../../services/restaurant/booking.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../exceptions/AppError');

class BookingController {
  /**
   * Public Anonymous Web Slot Booking Creation.
   * POST /api/v1/bookings/public/create
   */
  createAnonymousBooking = asyncHandler(async (req, res) => {
    const restaurantId = req.body.restaurantId || req.headers['x-restaurant-id'];
    if (!restaurantId) {
      throw new AppError(400, 'Restaurant identification is required.');
    }
    const result = await BookingService.createAnonymousBooking(restaurantId, req.body);
    return sendSuccess(res, 201, 'Anonymous slot booking created (pending payment)', result);
  });

  /**
   * Public Payment Verification for Web Slot Booking.
   * POST /api/v1/bookings/public/verify-payment
   */
  verifyAnonymousBookingPayment = asyncHandler(async (req, res) => {
    const restaurantId = req.body.restaurantId || req.headers['x-restaurant-id'];
    const result = await BookingService.verifyAnonymousBookingPayment(restaurantId, req.body);
    return sendSuccess(res, 200, 'Booking payment verified & confirmation email sent', result);
  });

  /**
   * Staff Coupon Verification & Table Assignment.
   * POST /api/v1/bookings/verify-coupon
   */
  verifyAndRedeemCoupon = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const result = await BookingService.verifyAndRedeemCoupon(restaurantId, req.body);
    return sendSuccess(res, 200, 'Coupon code verified, table assigned & QR activated', result);
  });

  /**
   * Real-time Walk-in Guest Table Allocation.
   * GET /api/v1/bookings/tables/available-for-walkin
   */
  getAvailableTablesForWalkIn = asyncHandler(async (req, res) => {
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'];
    const { numberOfPeople, bufferHours } = req.query;
    const result = await BookingService.getAvailableTablesForWalkIn(restaurantId, {
      numberOfPeople,
      bufferHours,
    });
    return sendSuccess(res, 200, 'Available tables for walk-in guests retrieved', result);
  });

  /**
   * Standard Staff Creation of Booking.
   */
  createBooking = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId || req.body.restaurantId || req.headers['x-restaurant-id'];
    if (!restaurantId) {
      throw new AppError(400, 'Restaurant identification is required.');
    }
    const booking = await BookingService.createBooking(restaurantId, req.body);
    return sendSuccess(res, 201, 'Table reservation confirmed successfully.', booking);
  });

  /**
   * Retrieve all bookings for restaurant staff.
   */
  getBookings = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId || req.headers['x-restaurant-id'];
    const bookings = await BookingService.getBookings(restaurantId, req.query);
    return sendSuccess(res, 200, 'Reservations list retrieved successfully.', bookings);
  });

  /**
   * Update booking.
   */
  updateBooking = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId || req.headers['x-restaurant-id'];
    const { id } = req.params;
    const updated = await BookingService.updateBooking(restaurantId, id, req.body);
    return sendSuccess(res, 200, 'Reservation details updated successfully.', updated);
  });

  /**
   * Webhook handler for external Dineout.
   */
  handleDineoutWebhook = asyncHandler(async (req, res) => {
    const { platform } = req.params;
    const restaurantId = req.body.restaurantId || req.body.outletId || req.headers['x-restaurant-id'];

    if (!restaurantId) {
      throw new AppError(400, 'Restaurant identification is missing in webhook request.');
    }

    const booking = await BookingService.processDineoutWebhook(restaurantId, platform, req.body);
    return sendSuccess(res, 200, `${platform} Dineout webhook processed successfully.`, booking);
  });
}

module.exports = new BookingController();
