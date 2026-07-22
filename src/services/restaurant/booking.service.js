const crypto = require('crypto');
const BookingRepository = require('../../repositories/restaurant/booking.repository');
const TableRepository = require('../../repositories/restaurant/table.repository');
const Restaurant = require('../../models/restaurant.model');
const PaymentService = require('./payment.service');
const { sendEmail } = require('../../utils/email');
const AppError = require('../../exceptions/AppError');
const logger = require('../../utils/logger');

class BookingService {
  /**
   * Public / Anonymous Web Slot Booking creation.
   * Calculates ₹20/person pre-booking fee, initializes mock payment, and returns checkout object.
   */
  async createAnonymousBooking(restaurantId, data) {
    const {
      customerName,
      customerEmail,
      customerMobile,
      numberOfPeople,
      bookingDate,
      timeSlot,
      tableNumber,
    } = data;

    // Verify target restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant not found.');
    }

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
          `Table "${tableNumber}" capacity (${table.capacity}) is insufficient for ${numberOfPeople} guests.`
        );
      }

      const conflict = await BookingRepository.findConflictingBooking(
        restaurantId,
        normalizedDate,
        timeSlot,
        table._id,
        table.tableNumber
      );

      if (conflict) {
        throw new AppError(400, `Table "${tableNumber}" is already booked for this date and time slot.`);
      }

      resolvedTableId = table._id;
      validatedTableNumber = table.tableNumber;
    }

    // Pre-booking fee: ₹20 per guest
    const perPersonFee = 20;
    const prebookingFee = numberOfPeople * perPersonFee;

    // Create payment order via PaymentService gateway abstraction
    const paymentOrder = await PaymentService.createPayment(restaurantId, {
      amount: prebookingFee,
      currency: 'INR',
      orderId: `SLOT_BOOKING_${Date.now()}`,
      paymentMethod: 'upi',
      metadata: { customerName, customerEmail, numberOfPeople, bookingDate, timeSlot },
    });

    const bookingData = {
      tableId: resolvedTableId,
      tableNumber: validatedTableNumber,
      customerName,
      customerEmail: customerEmail.toLowerCase(),
      customerMobile,
      numberOfPeople,
      bookingDate: normalizedDate,
      timeSlot,
      status: 'pending_payment',
      paymentId: paymentOrder.paymentId,
      prepayment: {
        amount: prebookingFee,
        status: 'pending',
        transactionId: paymentOrder.paymentId,
      },
      source: {
        platform: 'internal',
      },
    };

    const booking = await BookingRepository.create(restaurantId, bookingData);

    logger.info(
      { bookingId: booking._id, restaurantId, prebookingFee, paymentId: paymentOrder.paymentId },
      'Anonymous web slot booking initialized (pending payment)'
    );

    return {
      booking: {
        id: booking._id,
        restaurantId,
        customerName,
        customerEmail: booking.customerEmail,
        customerMobile,
        numberOfPeople,
        bookingDate: normalizedDate,
        timeSlot,
        prebookingFee,
        status: booking.status,
      },
      payment: {
        paymentId: paymentOrder.paymentId,
        gatewayOrderId: paymentOrder.gatewayOrderId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        status: paymentOrder.status,
      },
    };
  }

  /**
   * Verifies anonymous booking payment, generates Coupon Code, updates status to 'confirmed',
   * and dispatches HTML confirmation email to customer.
   */
  async verifyAnonymousBookingPayment(restaurantId, { bookingId, paymentId }) {
    let booking = null;
    if (bookingId) {
      booking = await BookingRepository.findById(restaurantId, bookingId);
    } else if (paymentId) {
      booking = await BookingRepository.findByPaymentId(restaurantId, paymentId);
    }

    if (!booking) {
      throw new AppError(404, 'Booking record not found for payment verification.');
    }

    const activeRestaurantId = restaurantId || booking.restaurantId;

    // Verify payment status with PaymentService
    const verifiedPayment = await PaymentService.verifyPayment(activeRestaurantId, {
      paymentId: paymentId || booking.paymentId,
    });

    if (verifiedPayment.status !== 'SUCCESS') {
      throw new AppError(400, `Payment verification failed. Current status: '${verifiedPayment.status}'.`);
    }

    // Generate unique verification coupon code (e.g. BK7F2A)
    const randomCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    const couponCode = `BK${randomCode}`;

    // Update booking record
    booking = await BookingRepository.update(activeRestaurantId, booking._id, {
      status: 'confirmed',
      couponCode,
      'prepayment.status': 'paid',
      'prepayment.transactionId': verifiedPayment.transactionId || verifiedPayment.paymentId,
    });

    // Fetch restaurant profile details for email template
    const restaurant = await Restaurant.findById(activeRestaurantId);
    const restaurantName = restaurant ? (restaurant.name || restaurant.restaurantName || 'MenuDot Partner Restaurant') : 'MenuDot Partner Restaurant';
    const addressStr = restaurant?.location
      ? `${restaurant.location.address}, ${restaurant.location.city}, ${restaurant.location.state} ${restaurant.location.pincode}`
      : 'Restaurant Premises';
    const restaurantContact = restaurant?.mobileNumber || '+91-9876543210';
    const formattedDate = new Date(booking.bookingDate).toDateString();

    // Assemble rich confirmation HTML email
    const emailSubject = `🎉 Booking Confirmed: ${restaurantName} (Coupon Code: ${couponCode})`;
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 30px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 30px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">Table Booking Confirmed!</h1>
            <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Thank you for reserving with ${restaurantName}</p>
          </div>

          <div style="padding: 30px;">
            <!-- Coupon Box -->
            <div style="background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 25px;">
              <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #1d4ed8; font-weight: 600; display: block; margin-bottom: 6px;">Your Verification Coupon Code</span>
              <span style="font-size: 32px; font-weight: 800; color: #1e40af; letter-spacing: 4px; font-family: monospace;">${couponCode}</span>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #3b82f6;">Present this code to the restaurant staff upon arrival.</p>
            </div>

            <!-- Booking Details Table -->
            <h3 style="font-size: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 0;">Reservation Summary</h3>
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin-bottom: 25px;">
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Customer Name:</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #0f172a;">${booking.customerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Contact Mobile:</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #0f172a;">${booking.customerMobile}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Reservation Date:</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #0f172a;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Time Slot:</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #2563eb;">${booking.timeSlot}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Party Size:</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #0f172a;">${booking.numberOfPeople} Guests</td>
              </tr>
            </table>

            <!-- Restaurant Details -->
            <h3 style="font-size: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">Restaurant Venue Details</h3>
            <p style="margin: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${restaurantName}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #64748b;">📍 Address: ${addressStr}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #64748b;">📞 Contact: ${restaurantContact}</p>

            <!-- Pre-payment & Discount Credit Note -->
            <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 15px; border-radius: 6px; margin-top: 25px;">
              <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #065f46;">Pre-payment Paid: ₹${booking.prepayment.amount} (₹20 x ${booking.numberOfPeople} Guests)</h4>
              <p style="margin: 0; font-size: 12px; color: #047857;">
                <strong>Automatic Bill Credit:</strong> This pre-paid fee of <strong>₹${booking.prepayment.amount}</strong> will be automatically credited/deducted from your final dining bill upon checkout.
              </p>
            </div>
          </div>

          <div style="background: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
            MenuDot Smart Dining & Table Reservation System
          </div>
        </div>
      </div>
    `;

    // Send confirmation email
    await sendEmail({
      to: booking.customerEmail,
      subject: emailSubject,
      text: `Booking Confirmed at ${restaurantName}. Coupon Code: ${couponCode}. Date: ${formattedDate}, Time: ${booking.timeSlot}, Guests: ${booking.numberOfPeople}. Prepaid: ₹${booking.prepayment.amount}.`,
      html: emailHtml,
    });

    logger.info(
      { bookingId: booking._id, couponCode, email: booking.customerEmail },
      'Anonymous booking verified and confirmation email dispatched'
    );

    return booking;
  }

  /**
   * Staff verifies customer coupon code upon arrival, assigns table, and turns on table QR scanning.
   */
  async verifyAndRedeemCoupon(restaurantId, { couponCode, tableNumber }) {
    if (!couponCode) {
      throw new AppError(400, 'Verification couponCode is required.');
    }

    const booking = await BookingRepository.findByCouponCode(restaurantId, couponCode);
    if (!booking) {
      throw new AppError(404, `Invalid or unassigned coupon code '${couponCode}'.`);
    }

    if (booking.couponActivated) {
      throw new AppError(400, `Coupon code '${couponCode}' has already been redeemed and activated.`);
    }

    if (booking.status === 'cancelled') {
      throw new AppError(400, `Booking '${couponCode}' is cancelled.`);
    }

    let assignedTable = null;

    if (tableNumber) {
      assignedTable = await TableRepository.findByTableNumber(restaurantId, tableNumber);
      if (!assignedTable) {
        throw new AppError(404, `Table "${tableNumber}" not found.`);
      }

      if (assignedTable.capacity < booking.numberOfPeople) {
        throw new AppError(
          400,
          `Table "${tableNumber}" capacity (${assignedTable.capacity}) is smaller than guest party size (${booking.numberOfPeople}).`
        );
      }
    } else if (booking.tableId) {
      assignedTable = await TableRepository.findById(restaurantId, booking.tableId);
    }

    if (!assignedTable) {
      throw new AppError(400, 'Please specify a tableNumber to seat the customer.');
    }

    // 1. Activate table QR scanning and set status to occupied
    await TableRepository.update(restaurantId, assignedTable._id, {
      status: 'occupied',
      'qrCode.isActive': true,
      activeSession: {
        customerName: booking.customerName,
        numberOfPeople: booking.numberOfPeople,
        deviceId: `booking_${booking._id}`,
        scannedAt: new Date(),
      },
    });

    // 2. Update booking status to 'seated' and mark coupon activated
    const updatedBooking = await BookingRepository.update(restaurantId, booking._id, {
      status: 'seated',
      tableId: assignedTable._id,
      tableNumber: assignedTable.tableNumber,
      couponActivated: true,
      couponActivatedAt: new Date(),
    });

    logger.info(
      { bookingId: booking._id, couponCode, tableNumber: assignedTable.tableNumber },
      'Staff verified coupon code, assigned table, and activated QR scanning'
    );

    return {
      booking: updatedBooking,
      table: {
        id: assignedTable._id,
        tableNumber: assignedTable.tableNumber,
        qrCodeActive: true,
      },
    };
  }

  /**
   * Standard creation for staff/manual bookings.
   */
  async createBooking(restaurantId, data) {
    const { bookingDate, timeSlot, customerName, customerEmail, customerMobile, numberOfPeople, tableNumber, prepayment } = data;

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
      customerEmail: customerEmail ? customerEmail.toLowerCase() : '',
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
   * Retrieves all reservations for staff dashboard with history and filters.
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
    if (query.couponCode) {
      filters.couponCode = query.couponCode.toUpperCase();
    }

    return BookingRepository.findAll(restaurantId, filters);
  }

  /**
   * Updates a booking record.
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
   * Real-time Walk-in Guest Table Allocation.
   * Evaluates vacant tables, filtering out tables reserved for upcoming confirmed bookings within buffer window.
   */
  async getAvailableTablesForWalkIn(restaurantId, { numberOfPeople = 1, bufferHours = 2 }) {
    const allTables = await TableRepository.findAll(restaurantId);
    
    // Filter vacant tables with sufficient capacity
    const vacantTables = allTables.filter(
      (t) => t.status === 'vacant' && t.capacity >= Number(numberOfPeople)
    );

    const now = new Date();
    const windowEnd = new Date(now.getTime() + bufferHours * 60 * 60 * 1000);

    const todayDate = new Date(new Date().setUTCHours(0, 0, 0, 0));
    const upcomingBookings = await BookingRepository.findUpcomingConfirmedBookings(
      restaurantId,
      todayDate,
      todayDate
    );

    // Identify table IDs / Numbers reserved for upcoming confirmed slots
    const reservedTableIds = new Set();
    const reservedTableNumbers = new Set();

    upcomingBookings.forEach((b) => {
      if (b.tableId) reservedTableIds.add(b.tableId.toString());
      if (b.tableNumber) reservedTableNumbers.add(b.tableNumber);
    });

    // Return safe vacant tables that have no conflicting reservations
    const safeWalkInTables = vacantTables.filter(
      (t) => !reservedTableIds.has(t._id.toString()) && !reservedTableNumbers.has(t.tableNumber)
    );

    return {
      totalVacant: vacantTables.length,
      availableForWalkinCount: safeWalkInTables.length,
      tables: safeWalkInTables,
      reservedTableNumbers: Array.from(reservedTableNumbers),
    };
  }

  /**
   * Syncs external Dineout webhooks (Swiggy/Zomato).
   */
  async processDineoutWebhook(restaurantId, platform, payload) {
    const { bookingId, customer, reservationDate, reservationTime, guestCount, tableNumber } = payload;

    if (!bookingId || !customer || !reservationDate || !reservationTime || !guestCount) {
      throw new AppError(400, `Invalid webhook payload structure for platform ${platform}.`);
    }

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
      customerEmail: customer.email || 'guest@dineout.com',
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
