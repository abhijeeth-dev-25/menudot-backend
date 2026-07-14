const DailyFinanceReport = require('../models/dailyFinanceReport.model');

class DailyFinanceReportRepository {
  async upsertReport(restaurantId, date, reportData, options = {}) {
    return DailyFinanceReport.findOneAndUpdate(
      { restaurantId, date },
      { $set: { ...reportData, restaurantId, date } },
      { new: true, upsert: true, runValidators: true, ...options }
    );
  }

  async findByDate(restaurantId, date) {
    return DailyFinanceReport.findOne({ restaurantId, date });
  }

  async findByDateRange(restaurantId, startDate, endDate) {
    return DailyFinanceReport.find({
      restaurantId,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });
  }
}

module.exports = new DailyFinanceReportRepository();
