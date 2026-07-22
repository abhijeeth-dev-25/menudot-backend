const Booking = require('../../models/booking.model');

class BookingRepository {
  /**
   * Creates a new booking reservation.
   */
  async create(restaurantId, bookingData, options = {}) {
    const booking = new Booking({
      ...bookingData,
      restaurantId,
    });
    return booking.save(options);
  }

  /**
   * Finds a booking by ID.
   */
  async findById(restaurantId, id, options = {}) {
    const query = { _id: id };
    if (restaurantId) {
      query.restaurantId = restaurantId;
    }
    return Booking.findOne(query, null, options);
  }

  /**
   * Finds an external booking (Zomato/Swiggy) to ensure idempotency.
   */
  async findByExternalBookingId(restaurantId, platform, externalBookingId) {
    return Booking.findOne({
      restaurantId,
      'source.platform': platform,
      'source.externalBookingId': externalBookingId,
    });
  }

  /**
   * Checks if there's any active conflicting reservation for the table/tableNumber at the same slot.
   */
  async findConflictingBooking(restaurantId, bookingDate, timeSlot, tableId, tableNumber) {
    const query = {
      restaurantId,
      bookingDate,
      timeSlot,
      status: 'confirmed',
      $or: [],
    };

    if (tableId) {
      query.$or.push({ tableId });
    }
    if (tableNumber) {
      query.$or.push({ tableNumber });
    }

    if (query.$or.length === 0) {
      return null;
    }

    return Booking.findOne(query);
  }

  /**
   * Retrieves all bookings for a restaurant based on query parameters.
   */
  async findAll(restaurantId, filters = {}, options = {}) {
    const query = { restaurantId, ...filters };
    return Booking.find(query, null, options).sort({ bookingDate: 1, timeSlot: 1 });
  }

  /**
   * Finds a booking by verification coupon code.
   */
  async findByCouponCode(restaurantId, couponCode) {
    const query = { couponCode: couponCode.trim().toUpperCase() };
    if (restaurantId) {
      query.restaurantId = restaurantId;
    }
    return Booking.findOne(query);
  }

  /**
   * Finds a booking by payment ID.
   */
  async findByPaymentId(restaurantId, paymentId) {
    const query = { paymentId };
    if (restaurantId) {
      query.restaurantId = restaurantId;
    }
    return Booking.findOne(query);
  }

  /**
   * Finds upcoming confirmed bookings for a date range.
   */
  async findUpcomingConfirmedBookings(restaurantId, startDate, endDate) {
    return Booking.find({
      restaurantId,
      status: 'confirmed',
      bookingDate: { $gte: startDate, $lte: endDate },
    });
  }

  /**
   * Finds active seated booking for a table to apply bill discount credit.
   */
  async findActiveSeatedBookingForTable(restaurantId, tableId) {
    return Booking.findOne({
      restaurantId,
      tableId,
      status: 'seated',
      couponActivated: true,
    });
  }

  /**
   * Updates a booking record.
   */
  async update(restaurantId, id, updateData, options = {}) {
    return Booking.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: updateData },
      { new: true, runValidators: true, ...options }
    );
  }
}

module.exports = new BookingRepository();
