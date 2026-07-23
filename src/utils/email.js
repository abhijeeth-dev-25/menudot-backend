const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const logger = require('./logger');

// Ensure email logs directory exists in local environment
const EMAIL_LOGS_DIR = path.join(__dirname, '../../logs/emails');
if (config.env !== 'production') {
  if (!fs.existsSync(EMAIL_LOGS_DIR)) {
    fs.mkdirSync(EMAIL_LOGS_DIR, { recursive: true });
  }
}

/**
 * Creates SMTP transport if credentials are configured in environment.
 * Otherwise returns null to trigger console/file logging fallback.
 */
function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && port && user && pass) {
    return nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      auth: { user, pass },
      secure: port === '465', // true for port 465, false for other ports
    });
  }

  return null;
}

/**
 * Dispatcher function to send emails.
 * Falls back to local file logging in development/test environments if SMTP is unconfigured.
 * 
 * @param {object} options - Email sending configurations
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plaintext body
 * @param {string} options.html - HTML formatted body
 */
async function sendEmail({ to, subject, text, html }) {
  const { enqueueEmailJob } = require('../queues/workers/emailWorker');
  await enqueueEmailJob({ to, subject, text, html });
  return true;
}

module.exports = {
  sendEmail,
};
