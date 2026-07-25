const ExperienceService = require('../../models/experienceService.model');
const HeroBanner = require('../../models/heroBanner.model');
const Restaurant = require('../../models/restaurant.model');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../exceptions/AppError');

class ExperienceServiceController {
  // Experience Services CRUD
  createExperienceService = asyncHandler(async (req, res) => {
    const service = await ExperienceService.create({
      restaurantId: req.restaurantId,
      ...req.body,
    });
    return sendSuccess(res, 201, 'Experience service created successfully', service);
  });

  getExperienceServices = asyncHandler(async (req, res) => {
    const services = await ExperienceService.find({ restaurantId: req.restaurantId })
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();
    return sendSuccess(res, 200, 'Experience services retrieved successfully', services);
  });

  updateExperienceService = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const service = await ExperienceService.findOneAndUpdate(
      { _id: id, restaurantId: req.restaurantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!service) {
      throw new AppError(404, 'Experience service not found');
    }
    return sendSuccess(res, 200, 'Experience service updated successfully', service);
  });

  deleteExperienceService = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const service = await ExperienceService.findOneAndUpdate(
      { _id: id, restaurantId: req.restaurantId },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!service) {
      throw new AppError(404, 'Experience service not found');
    }
    return sendSuccess(res, 200, 'Experience service deleted successfully');
  });

  // Hero Banners CRUD
  createHeroBanner = asyncHandler(async (req, res) => {
    const banner = await HeroBanner.create({
      restaurantId: req.restaurantId,
      ...req.body,
    });
    return sendSuccess(res, 201, 'Hero banner created successfully', banner);
  });

  getHeroBanners = asyncHandler(async (req, res) => {
    const banners = await HeroBanner.find({ restaurantId: req.restaurantId })
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();
    return sendSuccess(res, 200, 'Hero banners retrieved successfully', banners);
  });

  updateHeroBanner = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const banner = await HeroBanner.findOneAndUpdate(
      { _id: id, restaurantId: req.restaurantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!banner) {
      throw new AppError(404, 'Hero banner not found');
    }
    return sendSuccess(res, 200, 'Hero banner updated successfully', banner);
  });

  deleteHeroBanner = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const banner = await HeroBanner.findOneAndUpdate(
      { _id: id, restaurantId: req.restaurantId },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!banner) {
      throw new AppError(404, 'Hero banner not found');
    }
    return sendSuccess(res, 200, 'Hero banner deleted successfully');
  });

  // Outlets / Branches Management
  updateBranches = asyncHandler(async (req, res) => {
    const { branches } = req.body;
    if (!Array.isArray(branches)) {
      throw new AppError(400, 'Branches must be an array');
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      req.restaurantId,
      { branches },
      { new: true, runValidators: true }
    );

    return sendSuccess(res, 200, 'Restaurant branches updated successfully', restaurant.branches);
  });
}

module.exports = new ExperienceServiceController();
