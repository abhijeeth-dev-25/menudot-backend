const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Generates an Access Token for a User or Screen.
 * @param {object} entity - User or Screen Mongoose document
 * @param {string} entityType - 'user' or 'screen'
 * @returns {string} Signed JWT Access Token
 */
function generateAccessToken(entity, entityType) {
  const payload = {
    id: entity._id,
    type: entityType,
  };

  if (entityType === 'user') {
    payload.globalRole = entity.globalRole;
  } else if (entityType === 'screen') {
    payload.restaurantId = entity.restaurantId;
    payload.assignedRole = entity.assignedRole;
    payload.screenType = entity.screenType;
  }

  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiration,
  });
}

/**
 * Generates a Refresh Token for a User or Screen.
 * @param {object} entity - User or Screen Mongoose document
 * @param {string} entityType - 'user' or 'screen'
 * @returns {string} Signed JWT Refresh Token
 */
function generateRefreshToken(entity, entityType) {
  const payload = {
    id: entity._id,
    type: entityType,
  };

  if (entityType === 'screen') {
    payload.restaurantId = entity.restaurantId;
  }

  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiration,
  });
}

/**
 * Verifies and decodes an Access Token.
 * @param {string} token - Signed JWT
 * @returns {object} Decoded payload
 */
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

/**
 * Verifies and decodes a Refresh Token.
 * @param {string} token - Signed JWT
 * @returns {object} Decoded payload
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
