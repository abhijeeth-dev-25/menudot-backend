const WebhookService = require('../services/webhook.service');
const { sendSuccess } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

class WebhookController {
  handleSwiggyOrder = asyncHandler(async (req, res) => {
    const order = await WebhookService.processSwiggyOrder(req.body);
    return sendSuccess(res, 200, 'Swiggy order processed successfully', order);
  });

  handleZomatoOrder = asyncHandler(async (req, res) => {
    const order = await WebhookService.processZomatoOrder(req.body);
    return sendSuccess(res, 200, 'Zomato order processed successfully', order);
  });

  handleMagicpinOrder = asyncHandler(async (req, res) => {
    const order = await WebhookService.processMagicpinOrder(req.body);
    return sendSuccess(res, 200, 'Magicpin order processed successfully', order);
  });
}

module.exports = new WebhookController();
