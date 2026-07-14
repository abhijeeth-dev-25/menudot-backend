const express = require('express');
const PlatformIntegrationController = require('../controllers/platformIntegration.controller');
const validate = require('../middlewares/validate');
const { protect, resolveTenant, restrictToRoles } = require('../middlewares/auth');
const {
  configureIntegrationSchema,
  updateIntegrationSchema,
} = require('../validators/platformIntegration.validator');

const router = express.Router();

// All integration endpoints require authentication and tenant resolution
router.use(protect);
router.use(resolveTenant);

// Only owners and managers are allowed to manage third-party integrations or trigger syncs
router.use(restrictToRoles('owner', 'manager'));

router.post('/', validate(configureIntegrationSchema), PlatformIntegrationController.configureIntegration);
router.get('/', PlatformIntegrationController.getIntegrations);
router.patch('/:id', validate(updateIntegrationSchema), PlatformIntegrationController.updateIntegration);
router.post('/:id/sync/menu', PlatformIntegrationController.syncMenu);

module.exports = router;
