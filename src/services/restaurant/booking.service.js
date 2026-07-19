const BookingRepository = require('../../repositories/restaurant/booking.repository');
const TableRepository = require('../../repositories/restaurant/table.repository');
const AppError = require('../../exceptions/AppError');
const logger = require('../../utils/logger');

class BookingService {
  /**
   * Creates a customer table reservation with capacity and conflict validations.
   */
  async createBooking(restaurantId, data) {
    const { bookingDate, timeSlot, customerName, customerMobile, numberOfPeople, tableNumber, prepayment } = data;

    // Normalize bookingDate to midnight UTC to keep queries matching exactly YYYY-MM-DD YYYY-MM-DD
    const normalizedDate = new Date(new Date(bookingDate).setUTCHours(0, 0, 0, 0));

    let resolvedTableId = null;
    let validatedTableNumber = null;

    if (tableNumber) {
      const table = await TableRepository.findByTableNumber(restaurantId, tableNumber);
      if (!table) {
        throw new AppError(404, `Table "${tableNumber}" not found in this restaurant.`);
      }

      if (table.capacity < numberOfPeople) {
        throw new AppError(
          400,
          `Table "${tableNumber}" has a capacity of ${table.capacity}, which is insufficient for ${numberOfPeople} people.`
        );
      }

      // Check conflict
      const conflict = await BookingRepository.findConflictingBooking(
        restaurantId,
        normalizedDate,
        timeSlot,
        table._id,
        table.tableNumber
      );

      if (conflict) {
        throw new AppError(400, `Table "${tableNumber}" is already booked for this slot.`);
      }

      resolvedTableId = table._id;
      validatedTableNumber = table.tableNumber;
    }

    const bookingData = {
      tableId: resolvedTableId,
      tableNumber: validatedTableNumber,
      customerName,
      customerMobile,
      numberOfPeople,
      bookingDate: normalizedDate,
      timeSlot,
      status: 'confirmed',
      prepayment: prepayment ? {
        amount: prepayment.amount || 0,
        status: prepayment.transactionId ? 'paid' : 'none',
        transactionId: prepayment.transactionId || null,
      } : { status: 'none' },
      source: {
        platform: 'internal',
        externalBookingId: null,
      },
    };

    const booking = await BookingRepository.create(restaurantId, bookingData);
    logger.info({ bookingId: booking._id, restaurantId }, 'Table reservation created successfully');
    return booking;
  }

  /**
   * Retrieves all reservations for a restaurant.
   */
  async getBookings(restaurantId, query) {
    const filters = {};

    if (query.bookingDate) {
      filters.bookingDate = new Date(new Date(query.bookingDate).setUTCHours(0, 0, 0, 0));
    }
    if (query.status) {
      filters.status = query.status;
    }
    if (query.platform) {
      filters['source.platform'] = query.platform;
    }

    return BookingRepository.findAll(restaurantId, filters);
  }

  /**
   * Updates a booking record (status/table assignments).
   */
  async updateBooking(restaurantId, id, updateData) {
    const booking = await BookingRepository.findById(restaurantId, id);
    if (!booking) {
      throw new AppError(404, 'Booking not found.');
    }

    const payload = {};

    if (updateData.status) {
      payload.status = updateData.status;
    }

    if (updateData.tableNumber) {
      const table = await TableRepository.findByTableNumber(restaurantId, updateData.tableNumber);
      if (!table) {
        throw new AppError(404, `Table "${updateData.tableNumber}" not found.`);
      }

      if (table.capacity < booking.numberOfPeople) {
        throw new AppError(
          400,
          `Table "${table.tableNumber}" capacity (${table.capacity}) is smaller than booking party size (${booking.numberOfPeople}).`
        );
      }

      // Check conflict
      const conflict = await BookingRepository.findConflictingBooking(
        restaurantId,
        booking.bookingDate,
        booking.timeSlot,
        table._id,
        table.tableNumber
      );

      if (conflict && conflict._id.toString() !== id) {
        throw new AppError(400, `Table "${table.tableNumber}" is already booked for this slot.`);
      }

      payload.tableId = table._id;
      payload.tableNumber = table.tableNumber;
    }

    if (updateData.prepayment) {
      payload.prepayment = {
        ...booking.prepayment.toObject(),
        ...updateData.prepayment,
      };
    }

    const updated = await BookingRepository.update(restaurantId, id, payload);
    logger.info({ bookingId: id, restaurantId }, 'Booking updated successfully');
    return updated;
  }

  /**
   * Processes a webhook request from Swiggy/Zomato Dineout to sync reservations.
   */
  async processDineoutWebhook(restaurantId, platform, payload) {
    const { bookingId, customer, reservationDate, reservationTime, guestCount, tableNumber } = payload;

    if (!bookingId || !customer || !reservationDate || !reservationTime || !guestCount) {
      throw new AppError(400, `Invalid webhook payload structure for platform ${platform}.`);
    }

    // Idempotency check
    const existing = await BookingRepository.findByExternalBookingId(restaurantId, platform, bookingId);
    if (existing) {
      logger.info({ bookingId, platform }, 'Duplicate Dineout webhook reservation. Skipping.');
      return existing;
    }

    const normalizedDate = new Date(new Date(reservationDate).setUTCHours(0, 0, 0, 0));

    let resolvedTableId = null;
    let validatedTableNumber = null;

    if (tableNumber) {
      const table = await TableRepository.findByTableNumber(restaurantId, tableNumber);
      if (table) {
        resolvedTableId = table._id;
        validatedTableNumber = table.tableNumber;
      }
    }

    const bookingData = {
      tableId: resolvedTableId,
      tableNumber: validatedTableNumber,
      customerName: customer.name || `${platform} Dineout Guest`,
      customerMobile: customer.mobile || '',
      numberOfPeople: guestCount,
      bookingDate: normalizedDate,
      timeSlot: reservationTime,
      status: 'confirmed',
      prepayment: {
        amount: payload.prepaymentAmount || 0,
        status: payload.prepaymentAmount ? 'paid' : 'none',
        transactionId: payload.prepaymentTxnId || null,
      },
      source: {
        platform,
        externalBookingId: bookingId,
      },
    };

    const booking = await BookingRepository.create(restaurantId, bookingData);
    logger.info({ bookingId: booking._id, externalBookingId: bookingId, platform }, 'External Dineout booking synced successfully');
    return booking;
  }
}

module.exports = new BookingService();
