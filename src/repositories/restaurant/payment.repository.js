const Payment = require('../../models/payment.model');

class PaymentRepository {
  /**
   * Creates a new payment record.
   * @param {string} restaurantId - Owning tenant ID
   * @param {object} paymentData - Payment fields
   * @param {object} [options={}] - Mongoose transaction/session options
   */
  async create(restaurantId, paymentData, options = {}) {
    const payment = new Payment({
      ...paymentData,
      restaurantId,
    });
    return payment.save(options);
  }

  /**
   * Finds a payment record by its unique payment ID.
   * @param {string} restaurantId - Owning tenant ID
   * @param {string} paymentId - Payment ID (e.g. pay_mock_xxx)
   * @param {object} [options={}] - Query options
   */
  async findByPaymentId(restaurantId, paymentId, options = {}) {
    const query = { paymentId };
    if (restaurantId) {
      query.restaurantId = restaurantId;
    }
    return Payment.findOne(query, null, options);
  }

  /**
   * Finds a payment record by internal MongoDB _id or paymentId.
   * @param {string} restaurantId - Owning tenant ID
   * @param {string} id - Mongo _id or paymentId
   * @param {object} [options={}] - Query options
   */
  async findByIdOrPaymentId(restaurantId, id, options = {}) {
    const query = {
      $or: [{ paymentId: id }],
    };

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query.$or.push({ _id: id });
    }

    if (restaurantId) {
      query.restaurantId = restaurantId;
    }

    return Payment.findOne(query, null, options);
  }

  /**
   * Lists payments for a tenant matching filters.
   * @param {string} restaurantId - Owning tenant ID
   * @param {object} [filter={}] - Query filters (status, orderId, gateway)
   */
  async findAll(restaurantId, filter = {}) {
    const query = { ...filter };
    if (restaurantId) {
      query.restaurantId = restaurantId;
    }
    return Payment.find(query).sort({ createdAt: -1 });
  }

  /**
   * Updates payment record status or details.
   * @param {string} restaurantId - Owning tenant ID
   * @param {string} paymentId - Payment ID
   * @param {object} updateData - Attributes to update
   * @param {object} [options={}] - Mongoose options
   */
  async update(restaurantId, paymentId, updateData, options = {}) {
    const query = { paymentId };
    if (restaurantId) {
      query.restaurantId = restaurantId;
    }

    return Payment.findOneAndUpdate(
      query,
      { $set: updateData },
      { new: true, runValidators: true, ...options }
    );
  }
}

module.exports = new PaymentRepository();
