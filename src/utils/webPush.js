const webpush = require('web-push');
const logger = require('./logger');

// Generate VAPID keys if not set in environment
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa45xV1D72dFhN-38P3G8v2Yg-8G254J6538356-82-41-3g8h3-g-g-8-g-',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'h8f-4g3-g83-g8h3-g-g-8-g-g83-g8h3-g-g-8-g-',
};

try {
  // If valid VAPID keys are provided in env, generate runtime keys or use defaults
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    const generated = webpush.generateVAPIDKeys();
    vapidKeys.publicKey = generated.publicKey;
    vapidKeys.privateKey = generated.privateKey;
    logger.info({ publicKey: vapidKeys.publicKey }, 'Generated auto runtime VAPID keys for Web Push');
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@menudot.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
} catch (err) {
  logger.warn({ err }, 'WebPush VAPID setup fallback');
}

/**
 * Sends Web Push Notification to a subscription target
 */
async function sendWebPush(subscription, payload) {
  try {
    const stringPayload = JSON.stringify(payload);
    await webpush.sendNotification(subscription, stringPayload);
    return { success: true };
  } catch (error) {
    logger.error({ error: error.message, statusCode: error.statusCode }, 'Web push notification failed');
    if (error.statusCode === 404 || error.statusCode === 410) {
      // Subscription expired or invalid
      return { success: false, expired: true };
    }
    return { success: false, error: error.message };
  }
}

function getPublicKey() {
  return vapidKeys.publicKey;
}

module.exports = {
  sendWebPush,
  getPublicKey,
};
