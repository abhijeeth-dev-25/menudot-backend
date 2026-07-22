const dotenv = require('dotenv');
const Joi = require('joi');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = Joi.object({
  PORT: Joi.number().default(5000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  MONGODB_URI: Joi.string().required().description('MongoDB connection URI'),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  JWT_ACCESS_SECRET: Joi.string().required().min(32).description('JWT Access Token Secret (min 32 chars)'),
  JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().required().min(32).description('JWT Refresh Token Secret (min 32 chars)'),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),
  FIELD_ENCRYPTION_KEY: Joi.string()
    .required()
    .length(64)
    .hex()
    .description('Field Encryption Key (64-character hex string)'),
  IMAGEKIT_PUBLIC_KEY: Joi.string().allow('').default('ik_pub_mock'),
  IMAGEKIT_PRIVATE_KEY: Joi.string().allow('').default('ik_priv_mock'),
  IMAGEKIT_URL_ENDPOINT: Joi.string().allow('').uri().default('https://ik.imagekit.io/mock'),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX: Joi.number().default(100),
  REDIS_URI: Joi.string().default('redis://localhost:6379').description('Redis connection URI'),
  PAYMENT_MODE: Joi.string().valid('mock', 'razorpay', 'cashfree', 'stripe', 'phonepe').default('mock'),
})
  .unknown()
  .required();

const { value: envVars, error } = envVarsSchema.validate(process.env, {
  abortEarly: false,
});

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongoose: {
    url: envVars.MONGODB_URI,
    options: {
      // Modern mongoose configuration options
    },
  },
  logging: {
    level: envVars.LOG_LEVEL,
  },
  jwt: {
    accessSecret: envVars.JWT_ACCESS_SECRET,
    accessExpiration: envVars.JWT_ACCESS_EXPIRY,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    refreshExpiration: envVars.JWT_REFRESH_EXPIRY,
  },
  encryption: {
    key: envVars.FIELD_ENCRYPTION_KEY,
  },
  imagekit: {
    publicKey: envVars.IMAGEKIT_PUBLIC_KEY,
    privateKey: envVars.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: envVars.IMAGEKIT_URL_ENDPOINT,
  },
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    max: envVars.RATE_LIMIT_MAX,
  },
  redis: {
    url: envVars.REDIS_URI,
  },
  payment: {
    mode: envVars.PAYMENT_MODE,
  },
};
