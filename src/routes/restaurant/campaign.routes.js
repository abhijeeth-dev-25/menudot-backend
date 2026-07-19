const express = require('express');
const CampaignController = require('../../controllers/restaurant/campaign.controller');
const validate = require('../../middlewares/validate');
const { protect, resolveTenant, restrictToRoles } = require('../../middlewares/auth');
const {
  createCampaignSchema,
  updateCampaignSchema,
} = require('../../validators/campaign.validator');

const router = express.Router();

const mongoose = require('mongoose');
const AppError = require('../../exceptions/AppError');

// Public tenant resolution middleware (does not require auth context)
const resolvePublicTenant = (req, res, next) => {
  const restaurantIdStr = req.headers['x-restaurant-id'] || req.query.restaurantId || req.body.restaurantId;
  if (!restaurantIdStr) {
    return next(new AppError(400, 'Restaurant identification (x-restaurant-id header) is required.'));
  }
  if (!mongoose.Types.ObjectId.isValid(restaurantIdStr)) {
    return next(new AppError(400, 'Invalid restaurant identifier format.'));
  }
  req.restaurantId = new mongoose.Types.ObjectId(restaurantIdStr);
  next();
};

// 1. PUBLIC TABLE/CUSTOMER ACCESS ENDPOINTS (No protection, only tenant resolution)
router.get(
  '/active',
  resolvePublicTenant,
  CampaignController.getActiveSponsoredContent
);

router.post(
  '/:id/click',
  resolvePublicTenant,
  CampaignController.trackCampaignClick
);

// 2. STAFF PROTECTED CONFIGURATION ENDPOINTS
router.use(protect);
router.use(resolveTenant);

router.post(
  '/',
  restrictToRoles('owner', 'manager'),
  validate(createCampaignSchema),
  CampaignController.createCampaign
);

router.get(
  '/',
  restrictToRoles('owner', 'manager'),
  CampaignController.getCampaigns
);

router.patch(
  '/:id',
  restrictToRoles('owner', 'manager'),
  validate(updateCampaignSchema),
  CampaignController.updateCampaign
);

module.exports = router;
