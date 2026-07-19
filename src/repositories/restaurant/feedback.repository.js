const Feedback = require('../../models/feedback.model');

class FeedbackRepository {
  async create(restaurantId, feedbackData, options = {}) {
    const feedback = new Feedback({
      ...feedbackData,
      restaurantId,
    });
    return feedback.save(options);
  }

  async findById(restaurantId, id) {
    return Feedback.findOne({ _id: id, restaurantId });
  }

  async findByExternalId(restaurantId, source, externalReviewId) {
    return Feedback.findOne({ restaurantId, source, externalReviewId });
  }

  async findAll(restaurantId, filters = {}, options = {}) {
    const query = { restaurantId, ...filters };
    return Feedback.find(query, null, options).sort({ createdAt: -1 });
  }

  async update(restaurantId, id, updateData, options = {}) {
    return Feedback.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: updateData },
      { new: true, runValidators: true, ...options }
    );
  }
}

module.exports = new FeedbackRepository();
