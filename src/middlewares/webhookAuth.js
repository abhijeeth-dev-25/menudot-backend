const crypto = require('crypto');
const AppError = require('../exceptions/AppError');
const logger = require('../utils/logger');
const config = require('../config/env');

/**
 * Parameterized middleware to verify HMAC-SHA256 signatures for platform webhooks.
 * Falls back to warning logging in local development if no secret is configured.
 * 
 * @param {string} platform - Aggregator name ('swiggy', 'zomato', 'magicpin')
 */
function verifyWebhookSignature(platform) {
  return (req, res, next) => {
    let headerName = '';
    let secret = '';

    if (platform === 'swiggy') {
      headerName = 'x-swiggy-signature';
      secret = process.env.SWIGGY_WEBHOOK_SECRET;
    } else if (platform === 'zomato') {
      headerName = 'x-zomato-signature';
      secret = process.env.ZOMATO_WEBHOOK_SECRET;
    } else if (platform === 'magicpin') {
      headerName = 'x-magicpin-signature';
      secret = process.env.MAGICPIN_WEBHOOK_SECRET;
    } else {
      return next(new AppError(500, `Unsupported webhook signature verification platform: ${platform}`));
    }

    // Bypass verification in non-production if secret is missing to ease local developer setup
    if (!secret) {
      if (config.env !== 'production') {
        logger.warn(
          { platform },
          `Missing ${platform.toUpperCase()}_WEBHOOK_SECRET in local environment. Bypassing HMAC verification.`
        );
        return next();
      }
      return next(new AppError(500, `${platform.toUpperCase()}_WEBHOOK_SECRET is not configured.`));
    }

    const signature = req.headers[headerName];
    if (!signature) {
      return next(new AppError(401, `Access Denied: Missing signature header '${headerName}'`));
    }

    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : '';
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Use constant-time comparison to prevent timing attacks
    let signatureBuffer;
    let computedBuffer;
    
    try {
      signatureBuffer = Buffer.from(signature, 'utf8');
      computedBuffer = Buffer.from(computedSignature, 'utf8');
    } catch (err) {
      return next(new AppError(401, 'Invalid signature format.'));
    }

    if (signatureBuffer.length !== computedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, computedBuffer)) {
      logger.warn({ platform, signature, computedSignature }, 'Webhook HMAC signature mismatch');
      return next(new AppError(401, 'Access Denied: Webhook signature is invalid.'));
    }

    next();
  };
}

module.exports = {
  verifyWebhookSignature,
};
