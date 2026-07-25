const express = require('express');
const ExperienceServiceController = require('../../controllers/restaurant/experienceService.controller');
const validate = require('../../middlewares/validate');
const { protect, resolveTenant, restrictToRoles } = require('../../middlewares/auth');
const {
  createExperienceServiceSchema,
  updateExperienceServiceSchema,
  createHeroBannerSchema,
  updateHeroBannerSchema,
} = require('../../validators/experienceService.validator');

const router = express.Router();

// Require auth, tenant scoping, and owner/manager roles
router.use(protect);
router.use(resolveTenant);
router.use(restrictToRoles('owner', 'manager'));

// ==========================================
// EXPERIENCE SERVICES ENDPOINTS
// ==========================================
router.post(
  '/experience-services',
  validate(createExperienceServiceSchema),
  ExperienceServiceController.createExperienceService
);
router.get('/experience-services', ExperienceServiceController.getExperienceServices);
router.patch(
  '/experience-services/:id',
  validate(updateExperienceServiceSchema),
  ExperienceServiceController.updateExperienceService
);
router.delete('/experience-services/:id', ExperienceServiceController.deleteExperienceService);

// ==========================================
// HERO BANNERS ENDPOINTS
// ==========================================
router.post(
  '/hero-banners',
  validate(createHeroBannerSchema),
  ExperienceServiceController.createHeroBanner
);
router.get('/hero-banners', ExperienceServiceController.getHeroBanners);
router.patch(
  '/hero-banners/:id',
  validate(updateHeroBannerSchema),
  ExperienceServiceController.updateHeroBanner
);
router.delete('/hero-banners/:id', ExperienceServiceController.deleteHeroBanner);

// ==========================================
// OUTLETS & BRANCHES ENDPOINT
// ==========================================
router.put('/branches', ExperienceServiceController.updateBranches);

module.exports = router;
