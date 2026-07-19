const ScreenService = require('../../services/restaurant/screen.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

class ScreenController {
  createScreen = asyncHandler(async (req, res) => {
    const screen = await ScreenService.createScreen(req.restaurantId, req.body);
    return sendSuccess(res, 201, 'Screen terminal registered successfully', screen);
  });

  getScreens = asyncHandler(async (req, res) => {
    const screens = await ScreenService.getScreens(req.restaurantId);
    return sendSuccess(res, 200, 'Screens list retrieved successfully', screens);
  });

  updateScreen = asyncHandler(async (req, res) => {
    const { screenId } = req.params;
    const screen = await ScreenService.updateScreen(req.restaurantId, screenId, req.body);
    return sendSuccess(res, 200, 'Screen terminal updated successfully', screen);
  });

  deleteScreen = asyncHandler(async (req, res) => {
    const { screenId } = req.params;
    await ScreenService.deleteScreen(req.restaurantId, screenId);
    return sendSuccess(res, 200, 'Screen terminal unregistered successfully');
  });
}

module.exports = new ScreenController();
