const crypto = require('crypto');
const config = require('../config/env');
const logger = require('./logger');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV is standard for GCM
const KEY = Buffer.from(config.encryption.key, 'hex');

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format is `iv:authTag:ciphertext` encoded in hex.
 * @param {string} text - The plaintext string to encrypt
 * @returns {string} The encrypted string format `iv:authTag:ciphertext`
 */
function encrypt(text) {
  if (text === null || text === undefined || text === '') {
    return text;
  }

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Return iv, authTag, and ciphertext joined by colons
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (error) {
    logger.error({ err: error }, 'Field encryption failed');
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypts a hex string formatted as `iv:authTag:ciphertext` using AES-256-GCM.
 * If the input is not in the correct format, returns the value as-is.
 * @param {string} encryptedText - The encrypted string format `iv:authTag:ciphertext`
 * @returns {string} The decrypted plaintext string
 */
function decrypt(encryptedText) {
  if (encryptedText === null || encryptedText === undefined || encryptedText === '') {
    return encryptedText;
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      // If it doesn't match the format, it might be unencrypted/legacy data (e.g. from migrations)
      return encryptedText;
    }

    const [ivHex, authTagHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error({ err: error }, 'Field decryption failed');
    // If decryption fails (e.g., bad key or tampered ciphertext), return null or throw
    return null;
  }
}

module.exports = {
  encrypt,
  decrypt,
};
