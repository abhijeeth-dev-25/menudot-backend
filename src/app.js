const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const config = require('./config/env');
const logger = require('./utils/logger');
const AppError = require('./exceptions/AppError');
const errorHandler = require('./middlewares/errorHandler');
const { getDBHealth } = require('./database/db');
const { sendSuccess } = require('./utils/response');

const authRoutes = require('./routes/auth.routes');
const restaurantRoutes = require('./routes/restaurant.routes');
const menuRoutes = require('./routes/menu.routes');
const webhookRoutes = require('./routes/webhook.routes');
const tableRoutes = require('./routes/table.routes');
const staffRoutes = require('./routes/staff.routes');
const screenRoutes = require('./routes/screen.routes');
const orderRoutes = require('./routes/order.routes');
const path = require('path');

const app = express();

// 1. Trust proxy if behind a reverse proxy (like Nginx, Cloudflare, load balancer)
if (config.env === 'production') {
  app.set('trust proxy', 1);
}

// 2. Structured request logging via Pino-HTTP
app.use(
  pinoHttp({
    logger,
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        // Include IP address for tracing/audit purposes
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
    // Custom success log message
    customSuccessMessage: (req, res, responseTime) => {
      return `${req.method} ${req.url} completed with status ${res.statusCode} in ${responseTime}ms`;
    },
    // Custom error log message
    customErrorMessage: (req, res, err) => {
      return `${req.method} ${req.url} failed with status ${res.statusCode}: ${err.message}`;
    },
  })
);

// 3. Security Middlewares
app.use(helmet()); // Sets standard secure HTTP headers
app.use(cors());   // Allow CORS for frontends (e.g. tablet screens, client-side app)

// 4. Rate Limiting to prevent brute-force/DoS attacks
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
  },
});
app.use('/api', limiter); // Apply rate limiter to all API endpoints

// 5. Body Parsers
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
); // Limit body payload to prevent large payload attacks
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 6. Base / Health Check Endpoints
app.get('/health', (req, res) => {
  const dbHealth = getDBHealth();
  const serverHealth = {
    status: 'up',
    env: config.env,
    uptime: process.uptime(),
    db: dbHealth,
  };

  const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
  return sendSuccess(res, statusCode, 'Server health check information', serverHealth);
});

// 7. Route handlers
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/restaurants', restaurantRoutes);
app.use('/api/v1/menu', menuRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/tables', tableRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/screens', screenRoutes);
app.use('/api/v1/orders', orderRoutes);

// 8. 404 Handler for undefined routes
app.use((req, res, next) => {
  next(new AppError(404, `API route '${req.originalUrl}' with method '${req.method}' not found`));
});

// 9. Global Error Handling Middleware
app.use(errorHandler);

module.exports = app;
