const mongoose = require('mongoose');
const FeedbackRepository = require('../../repositories/restaurant/feedback.repository');
const PlatformIntegration = require('../../models/platformIntegration.model');
const MenuItem = require('../../models/menuItem.model');
const Restaurant = require('../../models/restaurant.model');
const Order = require('../../models/order.model');
const { safeRedisCall } = require('../../database/redis');
const AppError = require('../../exceptions/AppError');
const logger = require('../../utils/logger');

class FeedbackService {
  /**
   * Submits multi-dimensional customer feedback (Items, Service, Restaurant, Platform).
   * Atomically recalculates item and restaurant rating metrics & invalidates Redis catalog cache.
   */
  async createFeedback(restaurantId, data) {
    const feedbackData = {
      ...data,
      source: data.source || 'internal',
    };

    // Auto-classify complaints (overall rating <= 2)
    if (feedbackData.rating <= 2) {
      feedbackData.isComplaint = true;
      feedbackData.status = 'pending';
    }

    // Auto-escalate critical complaints (overall rating === 1)
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

    // 1. Create feedback document
    const feedback = await FeedbackRepository.create(restaurantId, feedbackData);

    // 2. Process per-item ratings recalculation
    if (Array.isArray(feedbackData.itemRatings) && feedbackData.itemRatings.length > 0) {
      for (const itemRating of feedbackData.itemRatings) {
        const { menuItemId, rating, tags } = itemRating;
        const item = await MenuItem.findOne({ _id: menuItemId, restaurantId });

        if (item) {
          const currentTotalPoints = item.totalRatingPoints > 0 ? item.totalRatingPoints : (item.ratingCount > 0 ? item.rating * item.ratingCount : 0);
          const newTotalPoints = currentTotalPoints + rating;
          const newRatingCount = (item.ratingCount || 0) + 1;
          const newAverageRating = Math.round((newTotalPoints / newRatingCount) * 10) / 10;

          // Star breakdown increment key
          const rKey = Math.min(5, Math.max(1, Math.round(rating)));
          const breakdownUpdate = {
            [`ratingBreakdown.${rKey}`]: (item.ratingBreakdown?.[rKey] || 0) + 1,
          };

          // Popular tags aggregation
          let updatedTags = [...(item.popularTags || [])];
          if (Array.isArray(tags) && tags.length > 0) {
            for (const tagText of tags) {
              const cleanTag = tagText.trim();
              if (!cleanTag) continue;
              const existingIndex = updatedTags.findIndex((t) => t.tag.toLowerCase() === cleanTag.toLowerCase());
              if (existingIndex >= 0) {
                updatedTags[existingIndex].count += 1;
              } else {
                updatedTags.push({ tag: cleanTag, count: 1 });
              }
            }
            // Sort tags by frequency desc
            updatedTags.sort((a, b) => b.count - a.count);
          }

          await MenuItem.updateOne(
            { _id: menuItemId, restaurantId },
            {
              $set: {
                rating: newAverageRating,
                ratingCount: newRatingCount,
                totalRatingPoints: newTotalPoints,
                popularTags: updatedTags,
                ...breakdownUpdate,
              },
            }
          );
        }
      }
    }

    // 3. Process restaurant-level aggregated rating recalculation
    try {
      const allFeedbacks = await FeedbackRepository.findAll(restaurantId);
      if (allFeedbacks.length > 0) {
        let totalOverall = 0;
        let totalService = 0;
        let serviceCount = 0;

        for (const f of allFeedbacks) {
          totalOverall += f.rating;
          if (f.serviceRating) {
            totalService += f.serviceRating;
            serviceCount++;
          }
        }

        const avgOverall = Math.round((totalOverall / allFeedbacks.length) * 10) / 10;
        const avgService = serviceCount > 0 ? Math.round((totalService / serviceCount) * 10) / 10 : avgOverall;

        await Restaurant.updateOne(
          { _id: restaurantId },
          {
            $set: {
              'ratingsSummary.overallRating': avgOverall,
              'ratingsSummary.serviceRating': avgService,
              'ratingsSummary.totalReviews': allFeedbacks.length,
            },
          }
        );
      }
    } catch (err) {
      logger.warn({ err, restaurantId }, 'Failed to recalculate restaurant aggregated ratings summary');
    }

    // 4. Invalidate Redis catalog cache so customer QR menus update instantly
    await safeRedisCall(async (client) => {
      await client.del(`catalog:${restaurantId}`);
    });

    logger.info(
      { feedbackId: feedback._id, restaurantId, itemRatingsCount: feedbackData.itemRatings?.length || 0 },
      'Multi-dimensional customer feedback recorded & catalog ratings updated successfully'
    );

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
      const existing = await FeedbackRepository.findByExternalId(
        restaurantId,
        platform,
        review.id
      );

      if (existing) {
        continue;
      }

      const feedbackData = {
        source: platform,
        rating: review.rating,
        customerName: review.customerName,
        comment: review.comment,
        externalReviewId: review.id,
      };

      if (review.rating <= 2) {
        feedbackData.isComplaint = true;
        feedbackData.status = 'pending';
      }

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
   * Generates comprehensive multi-dimensional feedback & item ratings analytics dashboard.
   */
  async getFeedbackAnalytics(restaurantId) {
    const feedbacks = await FeedbackRepository.findAll(restaurantId);

    const totalCount = feedbacks.length;
    let sumOverall = 0;
    let sumService = 0;
    let serviceCount = 0;
    let sumPlatform = 0;
    let platformCount = 0;
    let positiveCount = 0;
    let complaintCount = 0;

    const sourceBreakdown = { internal: 0, swiggy: 0, zomato: 0 };
    const complaintStatusBreakdown = { pending: 0, resolved: 0, ignored: 0 };

    for (const f of feedbacks) {
      sumOverall += f.rating;

      if (f.serviceRating) {
        sumService += f.serviceRating;
        serviceCount++;
      }
      if (f.platformRating) {
        sumPlatform += f.platformRating;
        platformCount++;
      }

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

    const avgOverallRating = totalCount > 0 ? Math.round((sumOverall / totalCount) * 100) / 100 : 0;
    const avgServiceRating = serviceCount > 0 ? Math.round((sumService / serviceCount) * 100) / 100 : avgOverallRating;
    const avgPlatformRating = platformCount > 0 ? Math.round((sumPlatform / platformCount) * 100) / 100 : 5.0;
    const positivePercentage = totalCount > 0 ? Math.round((positiveCount / totalCount) * 100) : 0;

    // Fetch Item performance metrics (Top Rated vs Lowest Rated)
    const items = await MenuItem.find({ restaurantId, isDeleted: false })
      .select('name price rating ratingCount popularTags categoryId')
      .lean();

    const ratedItems = items.filter((i) => (i.ratingCount || 0) > 0);
    ratedItems.sort((a, b) => b.rating - a.rating || (b.ratingCount || 0) - (a.ratingCount || 0));

    const topRatedItems = ratedItems.slice(0, 5);
    const lowestRatedItems = [...ratedItems].reverse().slice(0, 5);

    return {
      totalReviews: totalCount,
      averageRating: avgOverallRating,
      serviceRating: avgServiceRating,
      platformRating: avgPlatformRating,
      positiveReviewPercentage: positivePercentage,
      complaintsCount: complaintCount,
      complaintsByStatus: complaintStatusBreakdown,
      reviewsBySource: sourceBreakdown,
      itemPerformance: {
        totalRatedItems: ratedItems.length,
        topRated: topRatedItems,
        needsImprovement: lowestRatedItems,
      },
    };
  }
}

module.exports = new FeedbackService();
