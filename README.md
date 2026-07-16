# Menudot Backend — API Reference

> **Production-grade multi-tenant SaaS** powering restaurant table management, QR ordering, KDS, aggregator integrations, inventory, finance, reputation, and growth campaigns.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Getting Started](#2-getting-started)
3. [Architecture Concepts](#3-architecture-concepts)
4. [API — Authentication](#4-api--authentication)
5. [API — Restaurant Profile](#5-api--restaurant-profile)
6. [API — Staff Management](#6-api--staff-management)
7. [API — Tables & QR Ordering](#7-api--tables--qr-ordering)
8. [API — Menu Catalog & Images](#8-api--menu-catalog--images)
9. [API — Kitchen Display (KDS) & Orders](#9-api--kitchen-display-kds--orders)
10. [API — Webhook Integrations](#10-api--webhook-integrations)
11. [API — Platform Integrations](#11-api--platform-integrations)
12. [API — Dineout Bookings](#12-api--dineout-bookings)
13. [API — Inventory & Raw Materials](#13-api--inventory--raw-materials)
14. [API — Finance & P&L Reports](#14-api--finance--pl-reports)
15. [API — Reputation & Feedbacks](#15-api--reputation--feedbacks)
16. [API — Growth & Ads Campaigns](#16-api--growth--ads-campaigns)
17. [Error Codes Reference](#17-error-codes-reference)

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + Express.js |
| Database | MongoDB (Mongoose ORM) |
| Real-Time | Socket.io (WebSockets) |
| File Storage | ImageKit CDN (local disk fallback in dev) |
| Auth | JWT (Access 15m + Refresh 7d) |
| Encryption | AES-256-GCM field-level (PAN, GSTIN, bank details) |
| Validation | Joi declarative schemas |
| Logging | Pino structured JSON |

---

## 2. Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas URI)

### Environment Variables (`.env`)

```ini
PORT=5050
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/menudot
MONGODB_USE_TRANSACTIONS=false

# JWT
JWT_ACCESS_SECRET=your_32_byte_access_secret_here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_SECRET=your_32_byte_refresh_secret_here
JWT_REFRESH_EXPIRY=7d

# AES Field Encryption (must be 64 hex chars = 32 bytes)
FIELD_ENCRYPTION_KEY=64_character_hex_key_here

# ImageKit CDN
IMAGEKIT_PUBLIC_KEY=public_xxxx
IMAGEKIT_PRIVATE_KEY=private_xxxx
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id

# SMTP (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=google_app_password
SMTP_FROM=Menudot <you@gmail.com>
SMTP_COMPANY_RECEIVER=onboarding@menudot.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000

# Aggregator Webhook Secrets
SWIGGY_WEBHOOK_SECRET=swiggy_secret
ZOMATO_WEBHOOK_SECRET=zomato_secret
MAGICPIN_WEBHOOK_SECRET=magicpin_secret
```

### Run

```bash
npm install
npm run dev          # Development (nodemon)
npm start            # Production
```

> **Base URL**: All API routes are prefixed with `/api/v1`

---

## 3. Architecture Concepts

### Multi-Tenancy & Tenant Isolation

All operational collections use a Mongoose `auditablePlugin` that:
1. **Injects `restaurantId`** as a mandatory field on every document.
2. **Auto-filters queries** — every `find` / `findOne` automatically appends `{ isDeleted: false, restaurantId }` preventing cross-tenant data leaks.
3. **Auto-increments `version`** on every document update (optimistic concurrency marker).

> **`x-restaurant-id` header**: All protected staff routes require this header to identify the active restaurant tenant.

---

### Role-Based Access Control (RBAC)

| Role | Who | Access Level |
|---|---|---|
| `owner` | Restaurant proprietor | Full access. Can view raw legal/bank secrets. Creates managers. |
| `manager` | Operations manager | Full ops access. Cannot view raw legal secrets. Cannot create owner/manager accounts. |
| `chef` | Kitchen staff | Orders (accept/prepare/complete) + stock toggle. |
| `server` | Floor staff | Table views + service calls only. |
| `screen` | Physical KDS/Cashier tablet | Scoped to `allowedServices` and `allowedTables` filters. |
| `platform_admin` | Menudot internal staff | Cross-tenant access. Reviews onboarding. Can delete accounts. |

---

### Real-Time WebSockets

Socket.io runs on the same HTTP port as the REST API.

**Authentication** — Pass JWT in the handshake:
```js
socket.connect({ auth: { token: 'Bearer <accessToken>' } });
```

**Room**: Sockets auto-join `restaurant_<restaurantId>` room. Screen devices further filtered by `allowedTables` and `allowedServices`.

**Events emitted by server**:

| Event | Trigger |
|---|---|
| `order_created` | New dine-in or aggregator order received |
| `order_updated` | Order status changed |
| `service_call_received` | Customer presses water / bill / cleaning button |

---

## 4. API — Authentication

### `POST /auth/register`
Public registration — submits restaurant onboarding application.

**Body**:
```json
{
  "owner": {
    "fullName": "John Doe",
    "email": "owner@diner.com",
    "mobile": "+919876543210"
  },
  "restaurant": {
    "name": "The Great Diner",
    "outletType": "dine_in_and_delivery",
    "location": {
      "address": "123 Main St",
      "city": "Hyderabad",
      "state": "Telangana",
      "pincode": "500081",
      "coordinates": [78.432, 17.443]
    },
    "schedule": {
      "workingDays": ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
      "openTime": "11:00",
      "closeTime": "23:00"
    },
    "legal": {
      "pan": "ABCDE1234F",
      "gstin": "36ABCDE1234F1Z5",
      "fssaiNumber": "12345678901234",
      "fssaiExpiry": "2027-12-31"
    },
    "bank": {
      "ifsc": "SBIN0001234",
      "accountNumber": "987654321012"
    },
    "menuSetup": {
      "foodType": "both",
      "cuisines": ["Indian", "Chinese"],
      "costForTwo": 500
    }
  }
}
```

**Behavior**: Owner user created with `suspended` status. Restaurant saved as `submitted`. Notification email sent to company onboarding inbox.

---

### `POST /auth/login`
Authenticate restaurant owner or staff member.

**Body**: `{ "identifier": "owner@diner.com", "password": "password" }`

**Response**: `{ accessToken, refreshToken, user }`

---

### `POST /auth/login/screen`
Authenticate a physical KDS/cashier screen device.

**Body**: `{ "restaurantId": "id", "username": "kds_1", "password": "password" }`

---

### `POST /auth/refresh`
Exchange a valid refresh token for a new access token.

**Body**: `{ "refreshToken": "..." }`

---

### `POST /auth/logout`
Invalidate refresh token and end session.

**Headers**: `Authorization: Bearer <token>`

---

## 5. API — Restaurant Profile

> All routes require `Authorization: Bearer <token>` + `x-restaurant-id` (except admin routes).

### `GET /restaurants/profile`
Fetch the restaurant configuration profile.

- **Role**: Any authenticated staff.
- **Note**: `legal.pan`, `legal.gstin`, `bank.accountNumber`, `bank.ifsc` are replaced with `[REDACTED]` for non-owner roles.

---

### `PATCH /restaurants/profile`
Update restaurant details (name, location, schedule, cuisine, etc.).

- **Role**: `owner`, `manager`
- **Body** (all fields optional):
```json
{
  "name": "Updated Diner Name",
  "imageUrl": "https://ik.imagekit.io/.../restaurant.png",
  "location": {
    "address": "New Address",
    "city": "Hyderabad",
    "state": "Telangana",
    "pincode": "500081"
  },
  "schedule": {
    "workingDays": ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
    "openTime": "10:00",
    "closeTime": "23:00"
  },
  "outletType": "dine_in_and_delivery",
  "menuProfile": {
    "foodType": "both",
    "cuisines": ["Indian", "Chinese"],
    "costForTwo": 600
  }
}
```

---

### `POST /restaurants/profile/image`
Upload a restaurant cover photo to ImageKit CDN.

- **Role**: `owner` only
- **Content-Type**: `multipart/form-data`
- **Form Field**: `image` (JPG / PNG / WebP, max 5 MB)
- **Response**: `{ "imageUrl": "https://ik.imagekit.io/.../restaurant_photo.jpg" }`

---

### `GET /restaurants/onboarding/pending`
List all restaurant applications pending admin review.

- **Role**: `platform_admin` only

---

### `POST /restaurants/onboarding/:restaurantId/review`
Approve or reject an onboarding application.

- **Role**: `platform_admin` only
- **Body**: `{ "action": "approve" | "reject", "rejectionReason": "string (required if reject)" }`
- **Behavior on approve**: Owner account activated, random temp password generated, RestaurantStaff membership created, credentials emailed to owner.

---

### `DELETE /restaurants/admin/:id`
Soft-delete a restaurant account for legal / compliance reasons.

- **Role**: `platform_admin` only
- **Behavior**: Sets `isDeleted: true` and `deletedAt` timestamp. Data retained for audit trail.

---

## 6. API — Staff Management

> All routes require `Authorization: Bearer <token>` + `x-restaurant-id`.

### `POST /staff`
Register a new employee.

- **Role**: `owner`, `manager` (managers cannot create `owner`/`manager` accounts)
- **Body**:
```json
{
  "fullName": "Chef Remy",
  "email": "remy@diner.com",
  "mobile": "+919876543211",
  "password": "securepassword",
  "role": "chef",
  "salary": 25000
}
```

---

### `GET /staff`
Fetch the active employee directory.

- **Role**: `owner`, `manager`

---

### `PUT /staff/:staffId`
Update employee details or status.

- **Role**: `owner`, `manager`
- **Rule**: Managers cannot update or promote `owner` / `manager` accounts.

---

### `DELETE /staff/:staffId`
Soft-delete an employee and deactivate their login.

- **Role**: `owner`, `manager`

---

## 7. API — Tables & QR Ordering

> Protected routes require `Authorization: Bearer <token>` + `x-restaurant-id`.

### `POST /tables`
Create a new table layout entry.

- **Role**: `owner`, `manager`
- **Body**: `{ "tableNumber": "T-1", "capacity": 4 }`
- **Behavior**: Auto-generates a unique QR code hex token.

---

### `GET /tables`
List all configured tables.

- **Role**: Any authenticated staff.

---

### `PATCH /tables/:tableId/qr/toggle`
Enable or disable QR scanning on a table.

- **Role**: `owner`, `manager`
- **Body**: `{ "isActive": true | false }`

---

### `POST /tables/:tableId/checkout`
Check out a table session and release it back to vacant.

- **Role**: `owner`, `manager`, `server`

---

### `POST /tables/scan` *(Public)*
Customer scans QR code to start a table session.

**Body**:
```json
{
  "code": "hex_qr_token",
  "customerName": "Alice",
  "numberOfPeople": 2,
  "deviceId": "client_device_uuid"
}
```

**Response**: Restaurant details, active session, and the full live menu category tree.

---

### `POST /tables/call` *(Public)*
Customer presses a service request button.

**Body**:
```json
{
  "restaurantId": "id",
  "tableNumber": "T-1",
  "serviceType": "water" | "bill" | "cleaning" | "queries" | "others"
}
```

**Behavior**: Emits `service_call_received` Socket.io event to all screens configured for that service type and table.

---

### `POST /tables/order` *(Public)*
Customer places a dine-in order via QR session.

**Body**:
```json
{
  "code": "qr_hex_token",
  "deviceId": "customer_device_uuid",
  "items": [
    {
      "itemId": "menuItemObjectId",
      "quantity": 2,
      "addOns": [{ "name": "Extra Cheese" }]
    }
  ]
}
```

**Security Guards** (checked in order):
1. QR token must resolve to an existing table.
2. Table QR must be `isActive: true`.
3. Table must be `occupied` with an active customer session.
4. `deviceId` must exactly match the session owner's registered device.

**Pricing**: All prices resolved from DB — client prices are ignored.

**Calculations**: `subtotal = Σ (itemPrice + addOns) × qty` | `tax = subtotal × taxRate%` | `grandTotal = subtotal + tax`

---

## 8. API — Menu Catalog & Images

> All routes require `Authorization: Bearer <token>` + `x-restaurant-id`.

### `POST /menu/categories`
Create a menu category.

**Body**: `{ "name": "Desserts", "description": "Sweet treats" }`

---

### `GET /menu/categories`
List all menu categories.

---

### `PATCH /menu/categories/:categoryId`
Update category name or description.

---

### `DELETE /menu/categories/:categoryId`
Soft-delete category and cascade-delete all items under it (DB transaction).

---

### `POST /menu/items`
Create a menu item.

**Body**:
```json
{
  "categoryId": "categoryObjectId",
  "name": "Vanilla Panna Cotta",
  "price": 180,
  "foodType": "veg",
  "platformMappings": {
    "zomato": { "itemId": "ZOM-DESSERT-1", "status": "active" }
  }
}
```

---

### `GET /menu/items`
List all menu items.

**Query Filters**: `categoryId`, `foodType`, `status`

---

### `PATCH /menu/items/:itemId`
Update menu item details.

---

### `DELETE /menu/items/:itemId`
Soft-delete a menu item.

---

### `PATCH /menu/items/:itemId/status`
Toggle item stock availability.

**Body**: `{ "status": "available" | "out_of_stock" }`

---

### `POST /menu/media`
Upload a menu item image to ImageKit CDN.

- **Content-Type**: `multipart/form-data`
- **Form Field**: `image` (JPG / PNG / WebP, max 5 MB)
- **Response**: `{ "url": "https://ik.imagekit.io/.../item.jpg", "fileId": "..." }`

---

## 9. API — Kitchen Display (KDS) & Orders

> All routes require `Authorization: Bearer <token>` + `x-restaurant-id`.

### `POST /screens`
Create a screen device (KDS, cashier terminal, reception tablet).

- **Role**: `owner`, `manager`
- **Body**:
```json
{
  "name": "Beverage Bar KDS",
  "screenType": "kitchen_display",
  "username": "bar_kds_1",
  "password": "securepassword",
  "assignedRole": "chef",
  "allowedServices": ["water"],
  "allowedTables": ["T-1", "T-2"]
}
```

---

### `GET /screens`
List all screen devices for the restaurant.

---

### `GET /orders`
Fetch the order queue.

**Query Filters**: `status`, `orderSource`, `tableNumber`

---

### `PATCH /orders/:orderId/status`
Update order preparation status.

- **Role**: `chef`, `manager`, `owner`
- **Body**: `{ "status": "accepted" | "preparing" | "completed" | "cancelled" }`
- **Behavior**: Updates DB and broadcasts `order_updated` Socket.io event.

---

## 10. API — Webhook Integrations

Called externally by Swiggy / Zomato / Magicpin. Each requires a valid **HMAC-SHA256 signature** header.

### `POST /webhooks/swiggy/order`
### `POST /webhooks/zomato/order`
### `POST /webhooks/magicpin/order`

**Behavior**:
1. Verifies HMAC-SHA256 signature.
2. Transforms aggregator payload to internal order format.
3. Idempotency check on `source.externalOrderId` to block duplicates.
4. Saves order to DB.
5. Emits `order_created` Socket.io event.

---

## 11. API — Platform Integrations

> All routes require `Authorization: Bearer <token>` + `x-restaurant-id` + `owner` or `manager` role.

### `POST /integrations`
Configure a third-party aggregator integration.

**Body**:
```json
{
  "platform": "swiggy" | "zomato" | "magicpin",
  "externalRestaurantId": "SWIG-12345",
  "credentials": {
    "accessToken": "raw_token",
    "refreshToken": "raw_refresh_token",
    "expiresAt": "2026-12-31T23:59:59.000Z"
  },
  "syncSettings": {
    "menuSync": true,
    "orderSync": true,
    "autoAcceptOrders": true
  }
}
```

**Behavior**: `accessToken` and `refreshToken` AES-256-GCM encrypted before DB write.

---

### `GET /integrations`
Fetch active platform integrations.

**Note**: Tokens decrypted for `owner`. Shown as `[REDACTED]` for all other roles.

---

### `PATCH /integrations/:id`
Update sync settings, status, or credentials.

---

### `POST /integrations/:id/sync/menu`
Trigger a menu sync simulation.

**Response**: `{ "syncedItemsCount": 12, "lastSyncedAt": "2026-07-14T..." }`

---

## 12. API — Dineout Bookings

### `POST /bookings` *(Public)*
Create a new table reservation.

**Body**:
```json
{
  "restaurantId": "restaurantObjectId",
  "bookingDate": "2026-07-20",
  "timeSlot": "19:00",
  "customerName": "Alice Customer",
  "customerMobile": "+919999988888",
  "numberOfPeople": 4,
  "tableNumber": "Table-15"
}
```

**Behavior**: Validates capacity vs. party size. Checks for conflicting confirmed bookings on same date + slot.

---

### `GET /bookings`
List bookings.

- **Role**: Any authenticated staff.
- **Query Filters**: `bookingDate`, `status`, `platform`

---

### `PATCH /bookings/:id`
Modify a booking status or re-assign table.

- **Role**: `owner`, `manager`, `server`

---

### `POST /bookings/webhooks/dineout/:platform` *(Public Webhook)*
Receive reservations from Swiggy / Zomato Dineout.

**Behavior**: Idempotency check on `source.externalBookingId`. Inserts confirmed booking.

---

## 13. API — Inventory & Raw Materials

> All routes require `Authorization: Bearer <token>` + `x-restaurant-id`.

### `POST /inventory/items`
Create a raw material / inventory item.

- **Role**: `owner`, `manager`
- **Body**:
```json
{
  "name": "Mozzarella Cheese",
  "unit": "kg",
  "currentStock": 0,
  "reorderThreshold": 2,
  "costPerUnit": 400
}
```

---

### `GET /inventory/items`
List all inventory items and current stock levels.

- **Role**: `owner`, `manager`, `chef`

---

### `POST /inventory/items/:id/adjust`
Manually adjust stock (restock, wastage, or correction).

- **Role**: `owner`, `manager`, `chef`
- **Body**:
```json
{
  "type": "purchase" | "wastage" | "adjustment",
  "quantity": 10,
  "reason": "Weekend restock"
}
```

**Behavior**: Atomically updates `currentStock` in a DB transaction + writes a ledger entry to `InventoryTransaction`.

---

## 14. API — Finance & P&L Reports

> All routes require `Authorization: Bearer <token>` + `x-restaurant-id`.

### `POST /finance/expenses`
Log a business expense.

- **Role**: `owner`, `manager`
- **Body**:
```json
{
  "date": "2026-07-14",
  "category": "raw_materials" | "utilities" | "rent" | "salaries" | "marketing" | "maintenance" | "other",
  "description": "Vegetable purchase",
  "amount": 3500
}
```

---

### `GET /finance/expenses`
Retrieve expense log.

- **Role**: `owner`, `manager`
- **Query Filters**: `startDate`, `endDate`, `category`

---

### `GET /finance/report/daily`
Generate a daily P&L rollup report.

- **Role**: `owner` only
- **Query**: `?date=2026-07-14`
- **Response**:
```json
{
  "date": "2026-07-14",
  "revenue": { "dineIn": 12000, "delivery": 4500, "total": 16500 },
  "expenses": { "total": 3500, "breakdown": { "raw_materials": 3500 } },
  "netProfit": 13000
}
```

---

## 15. API — Reputation & Feedbacks

### `POST /feedback` *(Public)*
Submit a customer review or complaint.

**Body**:
```json
{
  "restaurantId": "restaurantObjectId",
  "customerName": "Sam ColdFood",
  "rating": 2,
  "comment": "French fries were cold.",
  "orderId": "orderObjectId"
}
```

**Auto-classification**: `rating <= 2` sets `isComplaint: true`, `status: 'pending'`

**Auto-escalation**: `rating === 1` sets `escalatedToOwner: true`

---

### `GET /feedback`
Retrieve customer reviews and complaint log.

- **Role**: Any authenticated staff.
- **Query Filters**: `source` (internal / swiggy / zomato), `isComplaint`, `status`, `escalatedToOwner`

---

### `GET /feedback/analytics`
Fetch aggregated dashboard stats (average rating, positive %, source breakdown, resolution rate).

- **Role**: `owner`, `manager`

---

### `PATCH /feedback/:id/resolve`
Resolve or ignore a customer complaint.

- **Role**: `owner`, `manager`
- **Body**: `{ "status": "resolved" | "ignored", "resolutionNotes": "Refunded the customer." }`
- **Behavior**: Records resolving manager's User ID and timestamp.

---

### `POST /feedback/sync/:platform`
Sync reviews from Swiggy / Zomato (idempotent).

- **Role**: `owner`, `manager`
- **Behavior**: Validates PlatformIntegration is active. Syncs reviews checking `externalReviewId` to block duplicates.

---

## 16. API — Growth & Ads Campaigns

### `GET /campaigns/active` *(Public)*
Fetch currently running sponsored items / banners for customer display screens.

- **Headers**: `x-restaurant-id` (no auth token required)
- **Behavior**: Returns active campaigns within date range and within budget. Atomically increments `metrics.impressions` for each served campaign.

---

### `POST /campaigns/:id/click` *(Public)*
Register a customer click on a campaign ad.

- **Headers**: `x-restaurant-id` (no auth token required)
- **Behavior**: Increments `metrics.clicks` by 1 and charges `costPerClick` to `currentSpent`. When `currentSpent >= budgetLimit`, campaign status automatically becomes `'completed'` and stops serving.

---

### `POST /campaigns`
Configure a new advertising campaign.

- **Role**: `owner`, `manager`
- **Body**:
```json
{
  "name": "Pizza Promo Weekend",
  "type": "sponsored_item" | "discount_banner",
  "menuItemId": "menuItemObjectId",
  "startDate": "2026-07-13T00:00:00Z",
  "endDate": "2026-07-15T23:59:59Z",
  "budgetLimit": 500,
  "costPerClick": 10
}
```

---

### `GET /campaigns`
List all campaigns for the restaurant.

- **Role**: `owner`, `manager`
- **Query Filters**: `status` (active / paused / completed), `type`

---

### `PATCH /campaigns/:id`
Modify campaign settings (budget, dates, CPC, or status).

- **Role**: `owner`, `manager`

---

## 17. Error Codes Reference

| HTTP Status | Meaning | Common Cause |
|---|---|---|
| `400` | Bad Request | Validation failure, business rule violation (table conflict, budget exhausted) |
| `401` | Unauthorized | Missing or expired JWT token |
| `403` | Forbidden | Insufficient role permissions |
| `404` | Not Found | Resource does not exist or is soft-deleted |
| `409` | Conflict | Duplicate resource (table number, email, external booking ID) |
| `500` | Internal Server Error | Unexpected server-side error (check Pino logs) |

**Error response format**:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Human-readable error description"
}
```

---
*Menudot Backend — © 2026. All rights reserved.*

