const InventoryTransaction = require('../models/inventoryTransaction.model');

class InventoryTransactionRepository {
  async create(restaurantId, txnData, options = {}) {
    const transaction = new InventoryTransaction({
      ...txnData,
      restaurantId,
    });
    return transaction.save(options);
  }

  async findAll(restaurantId, filters = {}, options = {}) {
    const query = { restaurantId, ...filters };
    return InventoryTransaction.find(query, null, options).sort({ recordedAt: -1 });
  }
}

module.exports = new InventoryTransactionRepository();
