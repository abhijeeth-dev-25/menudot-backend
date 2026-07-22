# Section 5.1: Environment Setup & Operations Guide

[← Schemas Index](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/03-inventory-finance-ads.md) | [Back to Documentation Portal →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/README.md)

---

## 1. Prerequisites
- **Node.js**: v18.0+
- **Database**: MongoDB v6.0+ (local instance or MongoDB Atlas URI)
- **Cache**: Redis v6.0+
- **Image Storage**: ImageKit account (for production CDN uploads)

---

## 2. Environment Variables Specification (`.env`)

```ini
PORT=5050
NODE_ENV=development

# Database Connection
MONGODB_URI=mongodb://localhost:27017/menudot
MONGODB_USE_TRANSACTIONS=false

# Redis Cache Connection
REDIS_URL=redis://localhost:6379

# JWT Authentication Secrets
JWT_ACCESS_SECRET=your_32_byte_access_secret_here_min_length
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_SECRET=your_32_byte_refresh_secret_here_min_length
JWT_REFRESH_EXPIRY=7d

# Hardware AES-256-GCM Field Encryption Key (64 Hex Characters = 32 Bytes)
FIELD_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# ImageKit CDN Credentials
IMAGEKIT_PUBLIC_KEY=public_xxxx
IMAGEKIT_PRIVATE_KEY=private_xxxx
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id

# SMTP Email Server Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=onboarding@menudot.com
SMTP_PASS=google_app_password
SMTP_FROM=Menudot Onboarding <onboarding@menudot.com>
SMTP_COMPANY_RECEIVER=verification@menudot.com

# Rate Limiting Guard
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000

# Aggregator Webhook Secrets
SWIGGY_WEBHOOK_SECRET=swiggy_secret_token
ZOMATO_WEBHOOK_SECRET=zomato_secret_token
MAGICPIN_WEBHOOK_SECRET=magicpin_secret_token
```

---

## 3. Local Execution Commands

```bash
# 1. Install all dependencies
npm install

# 2. Start Redis server locally
redis-server

# 3. Launch dev server with nodemon
npm run dev

# 4. Launch production cluster
npm start

# 5. Execute test suite
npm test
```

---

## 4. Server Health Check Endpoint

- **URL**: `GET http://localhost:5050/health`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Server health check information",
    "data": {
      "status": "up",
      "env": "development",
      "uptime": 142.8,
      "db": { "status": "healthy", "readyState": 1 }
    }
  }
  ```

---

[← Schemas Index](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/03-inventory-finance-ads.md) | [Back to Documentation Portal →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/README.md)
