const FeedbackService = require('../services/feedback.service');
const { sendSuccess } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

class FeedbackController {
  createFeedback = asyncHandler(async (req, res) => {
    // Public endpoint: req.body contains restaurantId
    const restaurantId = req.body.restaurantId;
    const feedback = await FeedbackService.createFeedback(restaurantId, req.body);
    return sendSuccess(res, 201, 'Feedback recorded successfully.', feedback);
  });

  getFeedbacks = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const feedbacks = await FeedbackService.getFeedbacks(restaurantId, req.query);
    return sendSuccess(res, 200, 'Feedbacks list retrieved successfully.', feedbacks);
  });

  resolveComplaint = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const { id } = req.params;
    const staffUserId = req.user._id; // User account ID from auth context
    const updated = await FeedbackService.resolveComplaint(
      restaurantId,
      id,
      staffUserId,
      req.body
    );
    return sendSuccess(res, 200, 'Complaint resolved successfully.', updated);
  });

  syncExternalReviews = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const { platform } = req.params;
    const summary = await FeedbackService.syncExternalReviews(restaurantId, platform);
    return sendSuccess(res, 200, 'External reviews synchronized successfully.', summary);
  });

  getFeedbackAnalytics = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const stats = await FeedbackService.getFeedbackAnalytics(restaurantId);
    return sendSuccess(res, 200, 'Feedback analytics retrieved successfully.', stats);
  });
}

module.exports = new FeedbackController();
