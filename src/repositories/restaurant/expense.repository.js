const Expense = require('../../models/expense.model');

class ExpenseRepository {
  async create(restaurantId, expenseData, options = {}) {
    const expense = new Expense({
      ...expenseData,
      restaurantId,
    });
    return expense.save(options);
  }

  async findById(restaurantId, id) {
    return Expense.findOne({ _id: id, restaurantId });
  }

  async findAll(restaurantId, filters = {}, options = {}) {
    const query = { restaurantId, ...filters };
    return Expense.find(query, null, options).sort({ date: -1 });
  }

  async sumByCategoryAndDate(restaurantId, date, category) {
    const results = await Expense.aggregate([
      {
        $match: {
          restaurantId,
          date,
          category,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);
    return results.length > 0 ? results[0].totalAmount : 0;
  }
}

module.exports = new ExpenseRepository();
