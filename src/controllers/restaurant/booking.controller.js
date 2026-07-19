const BookingService = require('../../services/restaurant/booking.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../exceptions/AppError');

class BookingController {
  createBooking = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId || req.body.restaurantId || req.headers['x-restaurant-id'];
    if (!restaurantId) {
      throw new AppError(400, 'Restaurant identification is required.');
    }
    const booking = await BookingService.createBooking(restaurantId, req.body);
    return sendSuccess(res, 201, 'Table reservation confirmed successfully.', booking);
  });

  getBookings = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const bookings = await BookingService.getBookings(restaurantId, req.query);
    return sendSuccess(res, 200, 'Reservations list retrieved successfully.', bookings);
  });

  updateBooking = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const { id } = req.params;
    const updated = await BookingService.updateBooking(restaurantId, id, req.body);
    return sendSuccess(res, 200, 'Reservation details updated successfully.', updated);
  });

  handleDineoutWebhook = asyncHandler(async (req, res) => {
    const { platform } = req.params;
    // Extract restaurant identification from payload or headers
    const restaurantId = req.body.restaurantId || req.body.outletId || req.headers['x-restaurant-id'];
    
    if (!restaurantId) {
      throw new AppError(400, 'Restaurant identification is missing in webhook request.');
    }

    const booking = await BookingService.processDineoutWebhook(restaurantId, platform, req.body);
    return sendSuccess(res, 200, `${platform} Dineout webhook processed successfully.`, booking);
  });
}

module.exports = new BookingController();
