# Section 1.2: Domain Isolation & Directory Layout

[← Overview](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/01-overview.md) | [Next: Security & Encryption →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/03-security-and-encryption.md)

---

## 1. Domain Isolation Philosophy

MenuDot strictly separates two distinct business domains at the file structure, route namespace, controller, service, and repository levels:

1. **Restaurant Operations Domain (`/api/v1/*`)**: Merchant-facing management and customer-facing QR ordering (Menu, KDS, Tables, Staff, Inventory, Finance, Bookings).
2. **Platform Administration Domain (`/api/v1/platform/*`)**: B2B Platform staff operations (Onboarding verification, platform ad campaigns, coupon creation, system health, and emergency controls).

---

## 2. Directory Layout Breakdown

```text
src/
├── app.js                          # Express app configuration & middleware pipeline
├── server.js                       # HTTP server, DB connections & WebSocket setup
│
├── config/
│   ├── env.js                      # Environment variable validation
│   └── platformPermissions.js     # Platform role permission definitions
│
├── controllers/                    # HTTP Controllers (Request parsing & Response dispatch)
│   ├── platform/                   # Ad, Coupon, Restaurant onboarding review, System, Verification
│   └── restaurant/                 # Auth, Booking, Campaign, Feedback, Finance, Inventory, Menu, Order, Staff, Table, Webhook
│
├── database/
│   ├── db.js                       # Mongoose connection manager & transaction helpers
│   └── redis.js                    # Redis client initialization & fail-safe wrapper
│
├── exceptions/
│   └── AppError.js                 # Operational error handling abstraction
│
├── middlewares/
│   ├── auth.js                     # JWT verification & tenant scoping check (`x-restaurant-id`)
│   ├── platformAuth.js             # Platform administrative permission verification
│   ├── validate.js                 # Joi schema validation middleware
│   ├── webhookAuth.js              # HMAC signature authentication for external webhooks
│   └── errorHandler.js             # Centralized error formatting middleware
│
├── models/                         # Mongoose Models & Schemas
│   ├── plugins/
│   │   └── auditablePlugin.js      # Global tenant injection (`restaurantId`), soft delete, and versioning
│   ├── restaurant.model.js         # Legal details, bank information, operating hours
│   ├── user.model.js               # Staff & platform admin user accounts
│   ├── table.model.js              # Table definitions, QR tokens, active session state
│   ├── menuItem.model.js           # Catalog items, prices, ingredients, addons
│   ├── order.model.js              # Orders, items, totals, status tracking
│   └── ... (21 models total)
│
├── repositories/                   # Data Access Layer (DB query abstraction)
│   ├── platform/                   # Platform resource repositories
│   └── restaurant/                 # Tenant resource repositories
│
├── routes/                         # Express Route Definitions
│   ├── platform/                   # Platform admin routes
│   └── restaurant/                 # Tenant operational & customer QR routes
│
├── services/                       # Business Logic Layer
│   ├── platform/                   # Document verification logic, ad serving logic
│   └── restaurant/                 # QR ordering, session locking, inventory deduction, finance calculation
│
└── utils/
    ├── encryption.js               # Hardware AES-256-GCM encryption helper
    ├── logger.js                   # Pino structured JSON logger
    ├── response.js                 # Standardized success JSON helper
    └── socket.js                   # Socket.io room dispatcher
```

---

## 3. Multi-Tenant Auditable Plugin (`auditablePlugin.js`)

All tenant-specific models register Mongoose's `auditablePlugin.js` which automatically enforces:

```javascript
// Automatically adds to Mongoose schemas:
1. restaurantId: { type: ObjectId, ref: 'Restaurant', required: true }
2. isDeleted: { type: Boolean, default: false }
3. version: { type: Number, default: 1 }

// Automatically hooks into Mongoose pre-find middleware:
this.where({ isDeleted: false, restaurantId: activeRestaurantId });
```

This guarantees that cross-tenant data leaks are physically impossible at the database query execution layer.

---

[← Overview](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/01-overview.md) | [Next: Security & Encryption →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/03-security-and-encryption.md)
