const BillRepository = require('../../repositories/restaurant/bill.repository');
const OrderRepository = require('../../repositories/restaurant/order.repository');
const TableRepository = require('../../repositories/restaurant/table.repository');
const BookingRepository = require('../../repositories/restaurant/booking.repository');
const RestaurantRepository = require('../../repositories/restaurant/restaurant.repository');
const AppError = require('../../exceptions/AppError');
const socketManager = require('../../utils/socket');
const logger = require('../../utils/logger');
const QRCode = require('qrcode');

class BillService {
  /**
   * Generates or refreshes an unpaid Bill for a table with itemized snapshots and dynamic payment QR code.
   */
  async generateBillForTable(restaurantId, tableId, staffUserId = null) {
    const table = await TableRepository.findById(restaurantId, tableId);
    if (!table) {
      throw new AppError(404, 'Table not found.');
    }

    // Query active un-cancelled orders for this table
    const activeOrders = await OrderRepository.findAll(restaurantId, {
      tableId,
      status: { $ne: 'cancelled' },
    });

    if (!activeOrders || activeOrders.length === 0) {
      throw new AppError(400, 'No active orders found for this table to generate a bill.');
    }

    // Resolve guest count (numberOfPeople) from session, orders, or table capacity
    const guestCount = table.activeSession?.numberOfPeople || activeOrders[0]?.numberOfPeople || 1;

    // Check if active seated booking exists with prepayment credit
    let prepaidDiscount = 0;
    const activeBooking = await BookingRepository.findActiveSeatedBookingForTable(restaurantId, tableId);
    if (activeBooking && activeBooking.prepayment && activeBooking.prepayment.amount > 0) {
      prepaidDiscount = activeBooking.prepayment.amount;
    }

    // Itemize and snapshot items from all active orders
    const itemMap = new Map();
    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    let calculatedPlatformCharge = 0;
    let totalOrderDiscount = 0;

    activeOrders.forEach((order) => {
      calculatedSubtotal += order.totals?.subtotal || 0;
      calculatedTax += order.totals?.tax || 0;
      calculatedPlatformCharge += order.totals?.platformCharge || 0;
      totalOrderDiscount += order.totals?.discount || 0;

      (order.items || []).forEach((item) => {
        const addOnsPrice = (item.addOns || []).reduce((acc, a) => acc + (a.price || 0), 0);
        const itemUnitPrice = item.price + addOnsPrice;
        const key = `${item.name}_${item.price}_${JSON.stringify(item.addOns || [])}`;

        if (itemMap.has(key)) {
          const existing = itemMap.get(key);
          existing.quantity += item.quantity;
          existing.total += itemUnitPrice * item.quantity;
        } else {
          itemMap.set(key, {
            itemId: item.itemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            addOns: item.addOns || [],
            tax: 0,
            total: itemUnitPrice * item.quantity,
          });
        }
      });
    });

    const items = Array.from(itemMap.values());
    const finalDiscount = totalOrderDiscount + prepaidDiscount;
    const rawTotal = calculatedSubtotal + calculatedTax + calculatedPlatformCharge - finalDiscount;
    const grandTotal = Math.max(0, Math.round(rawTotal * 100) / 100);
    const roundOff = Math.round((grandTotal - rawTotal) * 100) / 100;

    // Find existing unpaid bill for table or generate new invoice number
    let bill = await BillRepository.findActiveUnpaidBillForTable(restaurantId, tableId);
    let invoiceNumber;

    if (bill) {
      invoiceNumber = bill.invoiceNumber;
    } else {
      invoiceNumber = await BillRepository.generateNextInvoiceNumber(restaurantId);
    }

    // Generate Dynamic UPI Payment QR Code Data URI for table payment
    const upiUri = `upi://pay?pa=menudot.merchant@upi&pn=${encodeURIComponent('MenuDot Restaurant')}&am=${grandTotal}&tn=${encodeURIComponent(`Bill ${invoiceNumber}`)}&cu=INR`;
    let upiPaymentQrUrl = null;
    try {
      upiPaymentQrUrl = await QRCode.toDataURL(upiUri, { width: 300, margin: 1 });
    } catch (err) {
      logger.warn({ err }, 'Failed to generate QR code data URL for bill');
    }

    const customerData = {
      name: table.activeSession?.customerName || activeOrders[0]?.customer?.name || 'Guest Customer',
      mobile: activeOrders[0]?.customer?.mobile || '',
      email: '',
    };

    const billData = {
      invoiceNumber,
      tableId,
      tableNumber: table.tableNumber,
      numberOfPeople: guestCount,
      orderIds: activeOrders.map((o) => o._id),
      customer: customerData,
      items,
      totals: {
        subtotal: Math.round(calculatedSubtotal * 100) / 100,
        tax: Math.round(calculatedTax * 100) / 100,
        platformCharge: Math.round(calculatedPlatformCharge * 100) / 100,
        discount: Math.round(finalDiscount * 100) / 100,
        couponCode: activeOrders[0]?.totals?.couponCode || null,
        roundOff,
        grandTotal,
      },
      paymentStatus: 'unpaid',
      paymentChannel: 'offline',
      payments: [],
      upiPaymentQrUrl,
      createdBy: staffUserId,
    };

    if (bill) {
      bill = await BillRepository.update(restaurantId, bill._id, billData);
    } else {
      bill = await BillRepository.create(restaurantId, billData);
    }

    // Link billId to active orders
    await Promise.all(
      activeOrders.map((o) =>
        OrderRepository.update(restaurantId, o._id, { billId: bill._id, numberOfPeople: guestCount })
      )
    );

    // Broadcast WebSocket event
    socketManager.broadcastToRestaurant(restaurantId, 'bill_generated', bill);
    socketManager.emitToTable(tableId.toString(), 'bill_generated', bill);

    logger.info(
      { restaurantId, tableNumber: table.tableNumber, invoiceNumber, grandTotal },
      'Bill generated successfully for table'
    );

    return bill;
  }

  /**
   * Settles a bill (full or split payment) via Offline (Cash/POS Card/Counter UPI) or Online Gateway.
   */
  async settleBill(restaurantId, billId, settlementData = {}, staffUserId = null) {
    const bill = await BillRepository.findById(restaurantId, billId);
    if (!bill) {
      throw new AppError(404, 'Bill not found.');
    }

    if (bill.paymentStatus === 'paid') {
      throw new AppError(400, 'Bill is already settled and paid.');
    }

    const { payments = [], customer = {} } = settlementData;

    // Default to full Cash payment if payments array is empty
    let paymentRecords = payments;
    if (!payments || payments.length === 0) {
      paymentRecords = [
        {
          amount: bill.totals.grandTotal,
          method: 'cash',
          transactionRef: `CASH-${Date.now()}`,
          collectedBy: staffUserId,
          paidAt: new Date(),
        },
      ];
    } else {
      paymentRecords = payments.map((p) => ({
        amount: Number(p.amount) || 0,
        method: p.method || 'cash',
        transactionRef: p.transactionRef || null,
        collectedBy: staffUserId,
        paidAt: new Date(),
      }));
    }

    const totalPaid = paymentRecords.reduce((acc, p) => acc + p.amount, 0);
    const roundTotalPaid = Math.round(totalPaid * 100) / 100;
    const targetGrandTotal = Math.round(bill.totals.grandTotal * 100) / 100;

    if (roundTotalPaid < targetGrandTotal) {
      throw new AppError(
        400,
        `Insufficient payment amount. Required: ₹${targetGrandTotal}, Provided: ₹${roundTotalPaid}`
      );
    }

    // Determine paymentChannel
    const methods = paymentRecords.map((p) => p.method);
    const isAllOffline = methods.every((m) => ['cash', 'card_pos', 'counter_upi', 'prepaid'].includes(m));
    const isAllOnline = methods.every((m) => m === 'online_gateway');
    const paymentChannel = isAllOffline ? 'offline' : isAllOnline ? 'online' : 'mixed';

    const updatePayload = {
      paymentStatus: 'paid',
      paymentChannel,
      payments: paymentRecords,
      settledAt: new Date(),
      settledBy: staffUserId,
    };

    if (customer && (customer.name || customer.mobile)) {
      updatePayload.customer = {
        ...bill.customer,
        ...customer,
      };
    }

    const updatedBill = await BillRepository.update(restaurantId, bill._id, updatePayload);

    // Update associated orders to 'completed' & 'paid'
    if (bill.orderIds && bill.orderIds.length > 0) {
      const primaryMethod = paymentRecords[0]?.method || 'cash';
      await Promise.all(
        bill.orderIds.map((orderId) =>
          OrderRepository.update(restaurantId, orderId, {
            status: 'completed',
            'payment.status': 'paid',
            'payment.method': primaryMethod,
          })
        )
      );
    }

    // If active booking exists, mark completed
    if (bill.tableId) {
      const activeBooking = await BookingRepository.findActiveSeatedBookingForTable(restaurantId, bill.tableId);
      if (activeBooking) {
        await BookingRepository.update(restaurantId, activeBooking._id, {
          status: 'completed',
        });
      }

      // Check out and free table session
      await TableRepository.update(restaurantId, bill.tableId, {
        status: 'vacant',
        'qrCode.isActive': false,
        activeSession: null,
        qrUnlockRequest: {
          requested: false,
          customerName: '',
          numberOfPeople: 1,
          deviceId: '',
          requestedAt: null,
        },
      });
    }

    // Broadcast WebSocket events
    socketManager.broadcastToRestaurant(restaurantId, 'bill_settled', updatedBill);
    if (bill.tableId) {
      socketManager.emitToTable(bill.tableId.toString(), 'bill_settled', updatedBill);
    }

    logger.info(
      { restaurantId, invoiceNumber: bill.invoiceNumber, grandTotal: targetGrandTotal, paymentChannel },
      'Bill settled and table checked out successfully'
    );

    return updatedBill;
  }

  /**
   * Generates printable 80mm thermal receipt HTML and printer hardware payload.
   */
  async getPrintableReceipt(restaurantId, billId, format = 'html') {
    const bill = await BillRepository.findById(restaurantId, billId);
    if (!bill) {
      throw new AppError(404, 'Bill not found.');
    }

    const restaurant = await RestaurantRepository.findById(restaurantId);
    const restaurantName = restaurant?.name || 'MenuDot Restaurant';
    const address = restaurant?.address || '';
    const phone = restaurant?.phone || '';
    const gstin = restaurant?.gstin || 'GST-N/A';

    if (format === 'json') {
      return {
        bill,
        restaurant: { name: restaurantName, address, phone, gstin },
      };
    }

    // Thermal Receipt HTML Template (80mm width)
    const formattedDate = new Date(bill.createdAt).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const itemsHtml = (bill.items || [])
      .map(
        (item) => `
        <tr>
          <td style="text-align: left; padding: 4px 0;">${item.name} x${item.quantity}</td>
          <td style="text-align: right; padding: 4px 0; font-weight: bold;">₹${item.total.toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    const qrImageHtml = bill.upiPaymentQrUrl
      ? `<div style="text-align: center; margin-top: 12px;">
          <img src="${bill.upiPaymentQrUrl}" style="width: 140px; height: 140px;" alt="Payment QR" />
          <div style="font-size: 10px; color: #555; margin-top: 4px;">Scan & Pay via any UPI App</div>
        </div>`
      : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt #${bill.invoiceNumber}</title>
        <style>
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 280px;
            margin: 0 auto;
            padding: 10px;
            color: #000;
            background: #fff;
            font-size: 12px;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <h2 style="margin: 0; font-size: 16px;">${restaurantName}</h2>
          <div style="font-size: 10px;">${address}</div>
          <div style="font-size: 10px;">Phone: ${phone} | GST: ${gstin}</div>
        </div>
        <div class="divider"></div>
        <div>
          <div><strong>Invoice:</strong> #${bill.invoiceNumber}</div>
          <div><strong>Table:</strong> ${bill.tableNumber || 'Takeaway'} | <strong>Guests:</strong> ${bill.numberOfPeople || 1}</div>
          <div><strong>Date:</strong> ${formattedDate}</div>
          <div><strong>Customer:</strong> ${bill.customer?.name || 'Guest'}</div>
        </div>
        <div class="divider"></div>
        <table>
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="text-align: left;">Item</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="divider"></div>
        <table>
          <tr><td>Subtotal:</td><td class="text-right">₹${(bill.totals?.subtotal || 0).toFixed(2)}</td></tr>
          ${bill.totals?.tax ? `<tr><td>Taxes (GST):</td><td class="text-right">₹${bill.totals.tax.toFixed(2)}</td></tr>` : ''}
          ${bill.totals?.discount ? `<tr><td>Discount:</td><td class="text-right">-₹${bill.totals.discount.toFixed(2)}</td></tr>` : ''}
          <tr style="font-size: 14px; font-weight: bold;">
            <td>Grand Total:</td>
            <td class="text-right">₹${(bill.totals?.grandTotal || 0).toFixed(2)}</td>
          </tr>
        </table>
        <div class="divider"></div>
        <div class="text-center">
          <div><strong>Status:</strong> ${bill.paymentStatus.toUpperCase()} (${bill.paymentChannel.toUpperCase()})</div>
          ${qrImageHtml}
          <div style="margin-top: 12px; font-size: 11px;">Thank you for dining with us!</div>
        </div>
      </body>
      </html>
    `;

    return {
      html: htmlContent,
      bill,
    };
  }

  /**
   * Retrieves active unpaid bills stream & today's collection summary for live restaurant monitor.
   */
  async getLiveBills(restaurantId) {
    const liveBills = await BillRepository.findLiveBills(restaurantId);

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    const dailySummary = await BillRepository.getDailySummary(restaurantId, todayStart, todayEnd);

    return {
      liveBills,
      dailySummary,
    };
  }

  /**
   * Retrieves historical bills with search filters & pagination.
   */
  async getBillHistory(restaurantId, query = {}) {
    const filters = {};

    if (query.paymentStatus) {
      filters.paymentStatus = query.paymentStatus;
    }
    if (query.paymentChannel) {
      filters.paymentChannel = query.paymentChannel;
    }
    if (query.tableNumber) {
      filters.tableNumber = query.tableNumber;
    }
    if (query.invoiceNumber) {
      filters.invoiceNumber = { $regex: query.invoiceNumber, $options: 'i' };
    }
    if (query.startDate || query.endDate) {
      filters.createdAt = {};
      if (query.startDate) {
        filters.createdAt.$gte = new Date(new Date(query.startDate).setUTCHours(0, 0, 0, 0));
      }
      if (query.endDate) {
        filters.createdAt.$lte = new Date(new Date(query.endDate).setUTCHours(23, 59, 59, 999));
      }
    }

    return BillRepository.findAll(restaurantId, filters, {
      page: query.page,
      limit: query.limit,
    });
  }

  /**
   * Retrieves single bill details by ID.
   */
  async getBillDetails(restaurantId, billId) {
    const bill = await BillRepository.findById(restaurantId, billId);
    if (!bill) {
      throw new AppError(404, 'Bill not found.');
    }
    return bill;
  }
}

module.exports = new BillService();
