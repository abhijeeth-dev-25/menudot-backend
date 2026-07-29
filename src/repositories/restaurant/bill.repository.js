const Bill = require('../../models/bill.model');

class BillRepository {
  /**
   * Creates a new bill document.
   */
  async create(restaurantId, billData, options = {}) {
    const bill = new Bill({
      ...billData,
      restaurantId,
    });
    return bill.save(options);
  }

  /**
   * Finds a bill by ID for a tenant.
   */
  async findById(restaurantId, id, options = {}) {
    return Bill.findOne({ _id: id, restaurantId }, null, options);
  }

  /**
   * Finds a bill by invoice number.
   */
  async findByInvoiceNumber(restaurantId, invoiceNumber) {
    return Bill.findOne({ restaurantId, invoiceNumber });
  }

  /**
   * Finds an active unpaid or partially paid bill for a specific table.
   */
  async findActiveUnpaidBillForTable(restaurantId, tableId) {
    return Bill.findOne({
      restaurantId,
      tableId,
      paymentStatus: { $in: ['unpaid', 'partially_paid'] },
    }).sort({ createdAt: -1 });
  }

  /**
   * Finds all live active bills (unpaid/partially_paid) for live manager dashboard.
   */
  async findLiveBills(restaurantId) {
    return Bill.find({
      restaurantId,
      paymentStatus: { $in: ['unpaid', 'partially_paid'] },
    }).sort({ createdAt: -1 });
  }

  /**
   * Retrieves paginated bill history based on filters.
   */
  async findAll(restaurantId, filter = {}, options = {}) {
    const query = { ...filter, restaurantId };
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(options.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [bills, total] = await Promise.all([
      Bill.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Bill.countDocuments(query),
    ]);

    return {
      bills,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Updates bill record.
   */
  async update(restaurantId, id, updateData, options = {}) {
    return Bill.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: updateData },
      { new: true, runValidators: true, ...options }
    );
  }

  /**
   * Generates next sequential invoice number for a restaurant (e.g. INV-202607-0001).
   */
  async generateNextInvoiceNumber(restaurantId) {
    const now = new Date();
    const yearMonth = now.toISOString().slice(0, 7).replace('-', '');
    const prefix = `INV-${yearMonth}-`;

    const latestBill = await Bill.findOne(
      { restaurantId, invoiceNumber: { $regex: `^${prefix}` } },
      { invoiceNumber: 1 },
      { sort: { invoiceNumber: -1 } }
    );

    let nextNumber = 1;
    if (latestBill && latestBill.invoiceNumber) {
      const parts = latestBill.invoiceNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextNumber = lastSeq + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * Computes daily financial summary of settled bills breakdown (cash, card, upi, online).
   */
  async getDailySummary(restaurantId, startDate, endDate) {
    const matchStage = {
      restaurantId: new (require('mongoose').Types.ObjectId)(restaurantId),
      paymentStatus: 'paid',
      isDeleted: false,
      createdAt: { $gte: startDate, $lte: endDate },
    };

    const aggregation = await Bill.aggregate([
      { $match: matchStage },
      { $unwind: '$payments' },
      {
        $group: {
          _id: '$payments.method',
          totalAmount: { $sum: '$payments.amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = {
      cash: 0,
      card_pos: 0,
      counter_upi: 0,
      online_gateway: 0,
      prepaid: 0,
      totalSettled: 0,
    };

    aggregation.forEach((item) => {
      if (summary[item._id] !== undefined) {
        summary[item._id] = Math.round(item.totalAmount * 100) / 100;
      }
      summary.totalSettled += item.totalAmount;
    });

    summary.totalSettled = Math.round(summary.totalSettled * 100) / 100;
    return summary;
  }
}

module.exports = new BillRepository();
