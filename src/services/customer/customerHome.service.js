const Restaurant = require('../../models/restaurant.model');
const HeroBanner = require('../../models/heroBanner.model');
const Coupon = require('../../models/coupon.model');
const ExperienceService = require('../../models/experienceService.model');
const MenuCategory = require('../../models/menuCategory.model');
const Table = require('../../models/table.model');
const AppError = require('../../exceptions/AppError');

class CustomerHomeService {
  /**
   * Aggregates complete Home Page payload for customer web app
   */
  static async getHomeFeed(restaurantId, tableCode = null, deviceId = null) {
    if (!restaurantId) {
      throw new AppError(400, 'Restaurant ID is required');
    }

    const restaurant = await Restaurant.findById(restaurantId).lean();
    if (!restaurant) {
      throw new AppError(404, 'Restaurant not found');
    }

    // Parallel fetch for optimal latency
    const [heroBanners, experienceServices, categories, activeCoupons] = await Promise.all([
      HeroBanner.find({ restaurantId, isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean(),
      ExperienceService.find({ restaurantId, isAvailable: true }).sort({ sortOrder: 1, createdAt: -1 }).lean(),
      MenuCategory.find({ restaurantId, status: 'active' }).sort({ sortOrder: 1 }).lean(),
      Coupon.find({
        $or: [{ restaurantId }, { scope: 'platform' }],
        status: 'active',
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
      }).lean(),
    ]);

    // Check table session status if table code provided
    let sessionStatus = {
      isUnlocked: false,
      sessionState: 'not_scanned',
      tableNumber: null,
      tableId: null,
      activeSession: null,
    };

    if (tableCode) {
      const table = await Table.findOne({ restaurantId, 'qrCode.code': tableCode }).lean();
      if (table) {
        sessionStatus = {
          isUnlocked: Boolean(table.qrCode && table.qrCode.isActive),
          sessionState: table.status,
          tableNumber: table.tableNumber,
          tableId: table._id,
          activeSession: table.activeSession || null,
          qrUnlockRequested: Boolean(table.qrUnlockRequest && table.qrUnlockRequest.requested),
        };
      }
    }

    return {
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        location: restaurant.location,
        schedule: restaurant.schedule,
        outletType: restaurant.outletType,
        ratingsSummary: restaurant.ratingsSummary || { overallRating: 5.0, totalReviews: 0 },
        menuProfile: restaurant.menuProfile || { foodType: 'both', cuisines: [], costForTwo: 500 },
        imageUrl: restaurant.imageUrl || null,
        branches: restaurant.branches || [],
      },
      sessionStatus,
      heroBanners: heroBanners.map((b) => ({
        id: b._id,
        title: b.title,
        subtitle: b.subtitle,
        badgeText: b.badgeText,
        imageUrl: b.imageUrl,
        ctaType: b.ctaType,
        ctaTargetId: b.ctaTargetId,
        ctaLabel: b.ctaLabel,
      })),
      offers: activeCoupons.map((c) => ({
        id: c._id,
        code: c.code,
        description: c.description,
        discountType: c.discountType,
        discountValue: c.discountValue,
        minOrderValue: c.minOrderValue,
        maxDiscountLimit: c.maxDiscountLimit,
        endDate: c.endDate,
      })),
      experienceServices: experienceServices.map((s) => ({
        id: s._id,
        title: s.title,
        category: s.category,
        tagline: s.tagline,
        description: s.description,
        imageUrl: s.imageUrl,
        iconName: s.iconName,
        highlights: s.highlights,
        timing: s.timing,
        priceStartingFrom: s.priceStartingFrom,
      })),
      featuredCategories: categories.map((cat) => ({
        id: cat._id,
        name: cat.name,
        description: cat.description,
      })),
    };
  }

  /**
   * Fetch all experience services / amenities for a restaurant
   */
  static async getExperienceServices(restaurantId, category = null) {
    const filter = { restaurantId, isAvailable: true };
    if (category) {
      filter.category = category;
    }
    return ExperienceService.find(filter).sort({ sortOrder: 1, createdAt: -1 }).lean();
  }

  /**
   * Fetch all branches / outlets for a restaurant
   */
  static async getBranches(restaurantId) {
    const restaurant = await Restaurant.findById(restaurantId).select('name branches').lean();
    if (!restaurant) {
      throw new AppError(404, 'Restaurant not found');
    }
    return restaurant.branches || [];
  }
}

module.exports = CustomerHomeService;
