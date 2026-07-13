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
  const from = process.env.SMTP_FROM || 'noreply@menudot.com';
  const transport = createTransport();
  let smtpSuccess = false;

  if (transport) {
    try {
      const info = await transport.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      logger.info({ messageId: info.messageId, to }, 'Email sent successfully via SMTP');
      smtpSuccess = true;
    } catch (error) {
      logger.error({ err: error, to }, 'Failed to send email via SMTP');
      if (config.env === 'production') throw error;
    }
  }

  // In non-production environments, we always write a copy of the email to a local HTML log file
  // so developers can inspect and parse it easily (and so tests don't break).
  if (config.env !== 'production') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFileName = `email-${to}-${timestamp}.html`;
    const logFilePath = path.join(EMAIL_LOGS_DIR, logFileName);

    const fileContent = `
      <!--
        To: ${to}
        Subject: ${subject}
        Date: ${new Date().toISOString()}
      -->
      <div style="font-family: sans-serif; border: 1px solid #ccc; padding: 20px; max-width: 600px; margin: 20px auto;">
        <h2>Subject: ${subject}</h2>
        <p><strong>To:</strong> ${to}</p>
        <hr />
        ${html || `<pre>${text}</pre>`}
      </div>
    `;

    try {
      fs.writeFileSync(logFilePath, fileContent);
      logger.info({ logFilePath }, `Local email log generated: file://${logFilePath}`);
    } catch (err) {
      logger.error({ err }, 'Failed to write local email log file');
    }

    // Also output to console if SMTP was not used
    if (!smtpSuccess) {
      logger.info(`[MOCK EMAIL TO: ${to}] Subject: ${subject}\nBody:\n${text}`);
    }
  }

  return true;
}

module.exports = {
  sendEmail,
};
