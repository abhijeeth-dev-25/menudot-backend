const express = require('express');
const WebhookController = require('../../controllers/restaurant/webhook.controller');
const { verifyWebhookSignature } = require('../../middlewares/webhookAuth');

const router = express.Router();

// Aggregator webhook order routes protected by HMAC-SHA256 signature verifications
router.post('/swiggy/order', verifyWebhookSignature('swiggy'), WebhookController.handleSwiggyOrder);
router.post('/zomato/order', verifyWebhookSignature('zomato'), WebhookController.handleZomatoOrder);
router.post('/magicpin/order', verifyWebhookSignature('magicpin'), WebhookController.handleMagicpinOrder);

module.exports = router;
