const pino = require('pino');
const config = require('../config/env');

const logger = pino({
  level: config.logging.level,
  // Redact sensitive keys from log output
  redact: {
    paths: [
      'req.headers.authorization',
      '*.password',
      '*.passwordHash',
      '*.accessToken',
      '*.refreshToken',
      '*.bank.accountNumber',
      '*.bank.ifsc',
      '*.legal.pan',
      '*.legal.gstin',
    ],
    censor: '[REDACTED]',
  },
  base: config.env === 'production' ? { pid: process.pid } : undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
});

module.exports = logger;
