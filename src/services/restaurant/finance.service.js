const ExpenseRepository = require('../../repositories/restaurant/expense.repository');
const DailyFinanceReportRepository = require('../../repositories/restaurant/dailyFinanceReport.repository');
const Order = require('../../models/order.model');
const Expense = require('../../models/expense.model');
const logger = require('../../utils/logger');

class FinanceService {
  /**
   * Records a business expense.
   */
  async recordExpense(restaurantId, data) {
    const normalizedDate = new Date(new Date(data.date).setUTCHours(0, 0, 0, 0));
    const expenseData = {
      ...data,
      date: normalizedDate,
    };

    const expense = await ExpenseRepository.create(restaurantId, expenseData);
    logger.info({ expenseId: expense._id, restaurantId }, 'Expense record saved successfully');
    return expense;
  }

  /**
   * Retrieves all expenses for a restaurant.
   */
  async getExpenses(restaurantId, query) {
    const filters = {};
    if (query.category) {
      filters.category = query.category;
    }
    if (query.date) {
      filters.date = new Date(new Date(query.date).setUTCHours(0, 0, 0, 0));
    }
    return ExpenseRepository.findAll(restaurantId, filters);
  }

  /**
   * Generates or updates the Daily P&L finance rollup report for a specific date.
   */
  async generateDailyFinanceReport(restaurantId, date) {
    const normalizedDate = new Date(new Date(date).setUTCHours(0, 0, 0, 0));
    
    const startOfDay = new Date(normalizedDate);
    const endOfDay = new Date(normalizedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // 1. Calculate Completed Orders Revenue
    const completedOrders = await Order.find({
      restaurantId,
      status: 'completed',
      isDeleted: false,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    let dineInRevenue = 0;
    let deliveryRevenue = 0;

    for (const order of completedOrders) {
      const amount = order.totals.grandTotal || 0;
      if (order.orderSource === 'dine_in') {
        dineInRevenue += amount;
      } else {
        deliveryRevenue += amount;
      }
    }

    // Rounding to 2 decimal places
    dineInRevenue = Math.round(dineInRevenue * 100) / 100;
    deliveryRevenue = Math.round(deliveryRevenue * 100) / 100;

    // 2. Calculate Expenditures from Expense records
    const dayExpenses = await Expense.find({
      restaurantId,
      date: normalizedDate,
      isDeleted: false,
    });

    let salariesPaid = 0;
    let inventoryPurchased = 0;
    let utilitiesAndOthers = 0;

    for (const expense of dayExpenses) {
      const amount = expense.amount || 0;
      if (expense.category === 'salaries') {
        salariesPaid += amount;
      } else if (expense.category === 'raw_materials') {
        inventoryPurchased += amount;
      } else {
        utilitiesAndOthers += amount;
      }
    }

    salariesPaid = Math.round(salariesPaid * 100) / 100;
    inventoryPurchased = Math.round(inventoryPurchased * 100) / 100;
    utilitiesAndOthers = Math.round(utilitiesAndOthers * 100) / 100;

    // 3. Compute Net Profit/Loss
    const totalRevenue = dineInRevenue + deliveryRevenue;
    const totalExpenses = salariesPaid + inventoryPurchased + utilitiesAndOthers;
    const netProfitLoss = Math.round((totalRevenue - totalExpenses) * 100) / 100;

    const reportData = {
      revenue: {
        dineIn: dineInRevenue,
        delivery: deliveryRevenue,
      },
      expenditures: {
        salariesPaid,
        inventoryPurchased,
        utilitiesAndOthers,
      },
      netProfitLoss,
    };

    const report = await DailyFinanceReportRepository.upsertReport(
      restaurantId,
      normalizedDate,
      reportData
    );

    logger.info(
      { restaurantId, date: normalizedDate, netProfitLoss },
      'Successfully compiled daily finance report rollup'
    );

    return report;
  }

  /**
   * Retrieves list of daily P&L report rollups for a date range.
   */
  async getDailyReports(restaurantId, startDate, endDate) {
    const start = new Date(new Date(startDate).setUTCHours(0, 0, 0, 0));
    const end = new Date(new Date(endDate).setUTCHours(23, 59, 59, 999));
    return DailyFinanceReportRepository.findByDateRange(restaurantId, start, end);
  }
}

module.exports = new FinanceService();
