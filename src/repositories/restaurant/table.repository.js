const Table = require('../../models/table.model');

class TableRepository {
  /**
   * Creates a new table configuration.
   * @param {string} restaurantId - Owning restaurant
   * @param {object} tableData - Table details
   * @param {object} [options={}] - Mongoose transaction/session options
   */
  async create(restaurantId, tableData, options = {}) {
    const table = new Table({
      ...tableData,
      restaurantId,
    });
    return table.save(options);
  }

  /**
   * Finds a table by ID.
   * @param {string} restaurantId - Owning restaurant
   * @param {string} id - Table ID
   * @param {object} [options={}] - Mongoose options
   */
  async findById(restaurantId, id, options = {}) {
    return Table.findOne({ _id: id, restaurantId }, null, options);
  }

  /**
   * Finds a table by number.
   * @param {string} restaurantId - Owning restaurant
   * @param {string} tableNumber - Table description
   */
  async findByTableNumber(restaurantId, tableNumber) {
    return Table.findOne({
      tableNumber: { $regex: new RegExp(`^${tableNumber.trim()}$`, 'i') },
      restaurantId,
    });
  }

  /**
   * Finds a table by its unique QR code globally (for public customer scans).
   * @param {string} code - The secure QR code token
   */
  async findByQrCode(code) {
    return Table.findOne({ 'qrCode.code': code });
  }

  /**
   * Lists all active tables in a restaurant.
   * @param {string} restaurantId - Owning restaurant
   */
  async findAll(restaurantId) {
    return Table.find({ restaurantId }).sort({ tableNumber: 1 });
  }

  /**
   * Updates table details or session states.
   * @param {string} restaurantId - Owning restaurant
   * @param {string} id - Table ID
   * @param {object} updateData - Update values
   * @param {object} [options={}] - Mongoose options
   */
  async update(restaurantId, id, updateData, options = {}) {
    return Table.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: updateData },
      { new: true, runValidators: true, ...options }
    );
  }

  /**
   * Soft deletes a table layout.
   * @param {string} restaurantId - Owning restaurant
   * @param {string} id - Table ID
   * @param {object} [options={}] - Mongoose options
   */
  async delete(restaurantId, id, options = {}) {
    return Table.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true, ...options }
    );
  }
}

module.exports = new TableRepository();
