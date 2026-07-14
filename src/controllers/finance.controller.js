const FinanceService = require('../services/finance.service');
const { sendSuccess } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

class FinanceController {
  recordExpense = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const expense = await FinanceService.recordExpense(restaurantId, req.body);
    return sendSuccess(res, 201, 'Expense recorded successfully.', expense);
  });

  getExpenses = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const expenses = await FinanceService.getExpenses(restaurantId, req.query);
    return sendSuccess(res, 200, 'Expenses list retrieved successfully.', expenses);
  });

  getDailyReports = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const { startDate, endDate } = req.query;
    const reports = await FinanceService.getDailyReports(restaurantId, startDate, endDate);
    return sendSuccess(res, 200, 'Daily P&L finance reports retrieved successfully.', reports);
  });

  generateDailyFinanceReport = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const { date } = req.body;
    const report = await FinanceService.generateDailyFinanceReport(restaurantId, date);
    return sendSuccess(res, 200, 'Daily finance report generated successfully.', report);
  });
}

module.exports = new FinanceController();
