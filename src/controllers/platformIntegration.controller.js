const PlatformIntegrationService = require('../services/platformIntegration.service');
const { sendSuccess } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

class PlatformIntegrationController {
  configureIntegration = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const integration = await PlatformIntegrationService.configureIntegration(restaurantId, req.body);
    return sendSuccess(res, 201, 'Platform integration configured successfully.', integration);
  });

  getIntegrations = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const userRole = req.staff?.role;
    const integrations = await PlatformIntegrationService.getIntegrations(restaurantId, userRole);
    return sendSuccess(res, 200, 'Platform integrations retrieved successfully.', integrations);
  });

  updateIntegration = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const { id } = req.params;
    const updated = await PlatformIntegrationService.updateIntegration(restaurantId, id, req.body);
    return sendSuccess(res, 200, 'Platform integration updated successfully.', updated);
  });

  syncMenu = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const { id } = req.params;
    const result = await PlatformIntegrationService.syncMenu(restaurantId, id);
    return sendSuccess(res, 200, 'Platform menu synchronization successfully triggered (mock).', result);
  });
}

module.exports = new PlatformIntegrationController();
