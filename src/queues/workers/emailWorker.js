const queueManager = require('../queueManager');
const logger = require('../../utils/logger');
const path = require('path');
const fs = require('fs');

/**
 * Worker handler for email sending jobs.
 */
async function processEmailJob(payload) {
  const { to, subject, text, html } = payload;

  if (process.env.SMTP_HOST) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST.trim(),
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER.trim(),
          pass: process.env.SMTP_PASS.trim(),
        },
      });

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        html,
      });
      logger.info({ to, subject, messageId: info.messageId }, 'Email worker: Sent live SMTP email successfully');
    } catch (err) {
      logger.error({ err: err.message, stack: err.stack, to, subject }, 'Email worker: Failed to send SMTP email');
    }
  } else {
    // Generate local log file in development
    const logsDir = path.join(__dirname, '../../../logs/emails');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const safeTo = (to || 'recipient').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `email-${safeTo}-${new Date().toISOString().replace(/:/g, '-')}.html`;
    const filepath = path.join(logsDir, filename);

    const fileContent = `
      <!-- Menudot Development Email Log -->
      <div style="font-family: sans-serif; padding: 20px;">
        <h3>To: ${to}</h3>
        <h3>Subject: ${subject}</h3>
        <hr />
        ${html || `<pre>${text}</pre>`}
      </div>
    `;

    fs.writeFileSync(filepath, fileContent);
    logger.info({ to, subject, filepath: `file://${filepath}` }, 'Email worker: Mock email log generated');
  }
}

/**
 * Enqueues email sending job to background worker.
 */
async function enqueueEmailJob(emailPayload) {
  return queueManager.enqueue('email', 'SEND_EMAIL', emailPayload, processEmailJob);
}

module.exports = {
  processEmailJob,
  enqueueEmailJob,
};
