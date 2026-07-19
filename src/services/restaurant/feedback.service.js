const mongoose = require('mongoose');
const FeedbackRepository = require('../../repositories/restaurant/feedback.repository');
const PlatformIntegration = require('../../models/platformIntegration.model');
const Order = require('../../models/order.model');
const AppError = require('../../exceptions/AppError');
const logger = require('../../utils/logger');

class FeedbackService {
  /**
   * Submits customer feedback (internal).
   */
  async createFeedback(restaurantId, data) {
    const feedbackData = {
      ...data,
      source: 'internal',
    };

    // Auto-classify complaints (rating 1-2)
    if (feedbackData.rating <= 2) {
      feedbackData.isComplaint = true;
      feedbackData.status = 'pending';
    }

    // Auto-escalate extremely critical complaints (rating 1)
    if (feedbackData.rating === 1) {
      feedbackData.escalatedToOwner = true;
    }

    // Verify orderId links if provided
    if (feedbackData.orderId) {
      const orderExists = await Order.findOne({ _id: feedbackData.orderId, restaurantId });
      if (!orderExists) {
        throw new AppError(400, 'Associated Order ID was not found.');
      }
    }

    const feedback = await FeedbackRepository.create(restaurantId, feedbackData);
    logger.info({ feedbackId: feedback._id, restaurantId }, 'Customer feedback recorded successfully');
    return feedback;
  }

  /**
   * Retrieves list of feedback reviews and complaints.
   */
  async getFeedbacks(restaurantId, query) {
    const filters = {};
    if (query.source) {
      filters.source = query.source;
    }
    if (query.isComplaint !== undefined) {
      filters.isComplaint = query.isComplaint === 'true' || query.isComplaint === true;
    }
    if (query.status) {
      filters.status = query.status;
    }
    if (query.escalatedToOwner !== undefined) {
      filters.escalatedToOwner = query.escalatedToOwner === 'true' || query.escalatedToOwner === true;
    }
    return FeedbackRepository.findAll(restaurantId, filters);
  }

  /**
   * Resolves a customer complaint record with notes.
   */
  async resolveComplaint(restaurantId, feedbackId, staffUserId, resolutionData) {
    const feedback = await FeedbackRepository.findById(restaurantId, feedbackId);
    if (!feedback) {
      throw new AppError(404, 'Feedback record not found.');
    }

    if (!feedback.isComplaint) {
      throw new AppError(400, 'This feedback record is not classified as a complaint.');
    }

    const updateFields = {
      status: resolutionData.status,
      resolutionNotes: resolutionData.resolutionNotes,
      resolvedBy: staffUserId,
      resolvedAt: new Date(),
    };

    const updated = await FeedbackRepository.update(restaurantId, feedbackId, updateFields);
    logger.info({ feedbackId, restaurantId }, 'Customer complaint resolved successfully');
    return updated;
  }

  /**
   * Syncs external customer reviews/ratings from Swiggy/Zomato.
   */
  async syncExternalReviews(restaurantId, platform) {
    // 1. Verify platform integration is configured and active
    const integration = await PlatformIntegration.findOne({
      restaurantId,
      platform,
      status: 'active',
    });

    if (!integration) {
      throw new AppError(
        400,
        `Integration for platform "${platform}" is not active or configured. Please onboard the platform first.`
      );
    }

    // 2. Mock external aggregator reviews payload
    const mockReviews = [
      {
        id: `${platform.toUpperCase()}-REV-101`,
        customerName: 'Sam review',
        rating: 5,
        comment: 'Absolutely loved the packaging and speed!',
      },
      {
        id: `${platform.toUpperCase()}-REV-102`,
        customerName: 'Rohit K.',
        rating: 1,
        comment: 'Missing item in delivery order, extremely disappointing!',
      },
      {
        id: `${platform.toUpperCase()}-REV-103`,
        customerName: 'Nisha S.',
        rating: 4,
        comment: 'Super delicious and warm.',
      },
    ];

    let syncedCount = 0;

    for (const review of mockReviews) {
      // Check duplicate using idempotency
      const existing = await FeedbackRepository.findByExternalId(
        restaurantId,
        platform,
        review.id
      );

      if (existing) {
        continue;
      }

      // Prepare feedback object
      const feedbackData = {
        source: platform,
        rating: review.rating,
        customerName: review.customerName,
        comment: review.comment,
        externalReviewId: review.id,
      };

      // Auto-classify complaints
      if (review.rating <= 2) {
        feedbackData.isComplaint = true;
        feedbackData.status = 'pending';
      }

      // Auto-escalate rating 1
      if (review.rating === 1) {
        feedbackData.escalatedToOwner = true;
      }

      await FeedbackRepository.create(restaurantId, feedbackData);
      syncedCount++;
    }

    logger.info(
      { restaurantId, platform, syncedCount },
      'Aggregator reviews synchronization pipeline completed'
    );

    return {
      platform,
      syncedCount,
      totalProcessed: mockReviews.length,
    };
  }

  /**
   * Generates feedback statistics dashboard.
   */
  async getFeedbackAnalytics(restaurantId) {
    const feedbacks = await FeedbackRepository.findAll(restaurantId);

    const totalCount = feedbacks.length;
    let sumRating = 0;
    let positiveCount = 0;
    let complaintCount = 0;

    const sourceBreakdown = { internal: 0, swiggy: 0, zomato: 0 };
    const complaintStatusBreakdown = { pending: 0, resolved: 0, ignored: 0 };

    for (const f of feedbacks) {
      sumRating += f.rating;
      if (f.rating >= 4) {
        positiveCount++;
      }
      if (f.isComplaint) {
        complaintCount++;
        complaintStatusBreakdown[f.status]++;
      }
      if (sourceBreakdown[f.source] !== undefined) {
        sourceBreakdown[f.source]++;
      }
    }

    const avgRating = totalCount > 0 ? Math.round((sumRating / totalCount) * 100) / 100 : 0;
    const positivePercentage = totalCount > 0 ? Math.round((positiveCount / totalCount) * 100) : 0;

    return {
      totalReviews: totalCount,
      averageRating: avgRating,
      positiveReviewPercentage: positivePercentage,
      complaintsCount: complaintCount,
      complaintsByStatus: complaintStatusBreakdown,
      reviewsBySource: sourceBreakdown,
    };
  }
}

module.exports = new FeedbackService();
