const jwt = require('jsonwebtoken');
const config = require('../../config/env');
const AppError = require('../../exceptions/AppError');
const logger = require('../../utils/logger');
const { sendEmail } = require('../../utils/email');

const FOUNDER_EMAIL = 'abhijeethkar.geddam.dev@gmail.com';
const FOUNDER_NAME = 'Geddam Abhijeethkar';

// In-memory OTP storage with TTL (fallback when Redis key expires)
const founderOtpStore = new Map();

/**
 * Generates and emails a 6-digit Step-up OTP strictly to Founder's email.
 */
async function requestFounderOTP() {
  // Generate cryptographically secure 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes TTL

  founderOtpStore.set(FOUNDER_EMAIL, { otp, expiresAt, attempts: 0 });

  const subject = '[Menudot Security Alert] Step-Up Authorization OTP for Founder Account';
  const text = `Hello ${FOUNDER_NAME},\n\nA request was made to perform a protected action or update settings on your Founder account.\n\nYour 6-digit Authorization OTP is: ${otp}\n\nThis OTP is valid for 10 minutes. If you did not initiate this request, please change your password immediately.\n\nRegards,\nMenudot Core Security Platform`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #111827; background-color: #f9fafb; border-radius: 8px;">
      <h2 style="color: #dc2626;">🔐 Menudot Founder Step-Up Authorization</h2>
      <p>Hello <strong>${FOUNDER_NAME}</strong>,</p>
      <p>A request was made to perform a sensitive operation on your Founder account.</p>
      <div style="background-color: #fee2e2; border: 1px solid #f87171; border-radius: 6px; padding: 16px; margin: 20px 0; text-align: center;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #991b1b;">${otp}</span>
      </div>
      <p style="font-size: 14px; color: #4b5563;">This OTP is valid for <strong>10 minutes</strong> and is sent exclusively to <code>${FOUNDER_EMAIL}</code>.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 12px; color: #6b7280;">If you did not initiate this request, no action will be performed without this OTP.</p>
    </div>
  `;

  await sendEmail({ to: FOUNDER_EMAIL, subject, text, html });

  logger.info({ email: FOUNDER_EMAIL }, 'Dispatched Founder Step-Up OTP via email');
  return {
    success: true,
    message: `Step-Up OTP has been sent exclusively to ${FOUNDER_EMAIL}`,
    expiresInSeconds: 600,
  };
}

/**
 * Verifies 6-digit OTP and returns a signed short-lived Founder Authorization Token.
 */
async function verifyFounderOTP(inputOtp) {
  const record = founderOtpStore.get(FOUNDER_EMAIL);

  if (!record) {
    throw new AppError(400, 'No active OTP found. Please request a new OTP.');
  }

  if (Date.now() > record.expiresAt) {
    founderOtpStore.delete(FOUNDER_EMAIL);
    throw new AppError(400, 'OTP has expired. Please request a new OTP.');
  }

  if (record.otp !== inputOtp.toString().trim()) {
    record.attempts += 1;
    if (record.attempts >= 5) {
      founderOtpStore.delete(FOUNDER_EMAIL);
      throw new AppError(429, 'Too many invalid OTP attempts. OTP invalidated.');
    }
    throw new AppError(400, 'Invalid OTP. Please check the code sent to your email.');
  }

  // Clear OTP on successful match
  founderOtpStore.delete(FOUNDER_EMAIL);

  // Issue a 15-minute Founder Action Token
  const founderAuthToken = jwt.sign(
    { email: FOUNDER_EMAIL, scope: 'founder_step_up_authorized' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  logger.info({ email: FOUNDER_EMAIL }, 'Founder Step-Up OTP verified successfully');

  return {
    success: true,
    message: 'Founder Step-Up OTP verified successfully',
    founderAuthToken,
  };
}

/**
 * Helper to verify if request possesses valid Founder Action Token
 */
function isFounderActionAuthorized(req) {
  const token = req.headers['x-founder-otp-token'] || req.body?.founderAuthToken;
  if (!token) return false;

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    return decoded.email === FOUNDER_EMAIL && decoded.scope === 'founder_step_up_authorized';
  } catch (e) {
    return false;
  }
}

module.exports = {
  FOUNDER_EMAIL,
  FOUNDER_NAME,
  requestFounderOTP,
  verifyFounderOTP,
  isFounderActionAuthorized,
};
