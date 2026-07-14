# Menudot Multi-Tenant Backend Service

Menudot is a production-grade, highly scalable, multi-tenant SaaS backend powering restaurant table management, interactive digital menus, QR ordering, Kitchen Display Systems (KDS), and aggregator integrations (Swiggy, Zomato, Magicpin) with real-time sync.

---

## Technical Stack & Architecture

- **Runtime Environment**: Node.js & Express.js
- **Database**: MongoDB (Mongoose ORM)
- **Real-Time Layer**: Socket.io (WebSockets)
- **Security & Encryption**: AES-256-GCM field encryption for sensitive legal/financial records (PAN, GSTIN, Bank Details) and JWT-based authentication.
- **Log Management**: Pino structured JSON logging.
- **Data Validation**: Joi declarative validation schemas.

---

## 1. Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB running locally or Atlas URI

### Environment Variables
Configure a `.env` file at the root of the project:
```ini
PORT=5050
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/menudot

# JWT Keys
JWT_ACCESS_SECRET=your_access_secret_key_here
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_SECRET=your_refresh_secret_key_here
JWT_REFRESH_EXPIRATION=7d

# Encryption Key (Must be 32 bytes hex: 64 characters)
ENCRYPTION_KEY=64_character_hex_key_here

# Third Party Webhook Secrets
SWIGGY_WEBHOOK_SECRET=swiggy_secret_key_12345
ZOMATO_WEBHOOK_SECRET=zomato_secret_key_12345
MAGICPIN_WEBHOOK_SECRET=magicpin_secret_key_12345
```

### Installation & Run
```bash
# Install dependencies
npm install

# Start development server (using nodemon)
npm run dev
```

---

## 2. Multi-Tenancy & Security Rules

### Tenant Isolation
All collections containing operational business data inherit Mongoose `auditablePlugin`. This plugin:
1. Injects a mandatory `restaurantId` reference.
2. Intercepts all database queries (`find`, `findOne`, etc.) to automatically apply `{ isDeleted: false, restaurantId }` filters, preventing cross-tenant data leaks.
3. Automatically increments document `version` properties on edits.

### Role-Based Access Control (RBAC)
- **Owner**: Full administrative access across the tenant. Can create/modify Managers, Chefs, Servers, and retrieve legal secrets.
- **Manager**: Complete operational control. Can manage staff (Chefs, Servers only) and menus. Cannot view raw legal secrets (PAN, Bank Accounts) or create Owner/Manager accounts.
- **Chef**: Access to orders and menu stock toggles. Can modify order prep state (`preparing`, `completed`) and stock availability.
- **Server**: Access to active table layouts, sessions, and customer service requests.
- **Screen**: A physical hardware device (KDS, Cashier, Reception tablet) authenticated with scoped permissions and custom service/table filters.

---

## 3. Real-Time WebSockets (Socket.io)

Socket.io runs on the HTTP server port to sync state in real time:
- **Authentication**: Sockets require a valid JWT token passed during handshake (`auth: { token: '...' }`).
- **Room Scoping**: Sockets automatically join the room `restaurant_${restaurantId}` based on token details.
- **Dynamic Routing Filters**: For screen devices, notifications (like customer water alerts) are filtered against `allowedServices` and `allowedTables` mapped on the screen configuration.

### Outbound Events
- `order_created`: Emitted to KDS when a new order is received.
- `order_updated`: Emitted when an order changes status.
- `service_call_received`: Emitted to authorized server/cashier screens when a customer requests assistance.

---

## 4. API Documentation

### Auth & Onboarding Flow
All requests must be prefixed with `/api/v1`.

#### `POST /auth/register`
*Public registration for restaurant owner onboarding.*
- **Body Schema**:
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
        "cuisines": ["Chinese", "Indian"],
        "costForTwo": 500
      }
    }
  }
  ```
- **Behavior**: Owner user is created with `suspended` status. Restaurant status is saved as `submitted`. An application notification is sent to `onboarding@menudot.com`.

#### `POST /restaurants/onboarding/:restaurantId/review`
*Admin review endpoint (Platform Admin Only).*
- **Headers**: `Authorization: Bearer <PlatformAdminToken>`
- **Body**: `{ "action": "approve" || "reject", "rejectionReason": "string" }`
- **Behavior**: On approval, user account is activated, a random temporary password is generated, a `RestaurantStaff` membership link is created, and credentials are emailed to the owner.

#### `POST /auth/login`
*Authenticate staff or owners.*
- **Body**: `{ "identifier": "owner@diner.com", "password": "tempPassword" }`
- **Response**: Returns accessToken, refreshToken, and user details.

#### `POST /auth/login/screen`
*Authenticate physical tablet screens.*
- **Body**: `{ "restaurantId": "ID", "username": "prep_kds", "password": "password" }`
- **Response**: Returns device accessToken and refreshToken.

---

### Restaurant Profile & Staff Management

#### `GET /restaurants/profile`
*Fetch current restaurant configuration profile.*
- **Headers**: `Authorization: Bearer <Token>`, `x-restaurant-id: <RestaurantId>`
- **Response**: Returns restaurant object. Sensitive billing fields (`legal.pan`, `legal.gstin`, `bank.accountNumber`, etc.) are replaced with `[REDACTED]` if requested by non-owners (managers, servers, chefs).

#### `POST /staff`
*Register new employee credentials (Owners/Managers).*
- **Body**: `{ "fullName": "Chef Remy", "email": "remy@diner.com", "mobile": "+919876543211", "password": "securepassword", "role": "chef", "salary": 25000 }`
- **Rules**: Managers can only register `chef` and `server` accounts. Unique email/mobile validation is checked. Creates user and staff links inside a database transaction.

#### `GET /staff`
*Fetch active employee directories (Owners/Managers).*

#### `PUT /staff/:staffId`
*Update employee credentials or status.*
- **Rules**: Managers cannot update owners/managers, or promote users to manager/owner roles.

#### `DELETE /staff/:staffId`
*Soft delete employee and terminate membership.*

---

### Table & QR Code Management

#### `POST /tables`
*Create table layout details (Owners/Managers).*
- **Body**: `{ "tableNumber": "T-1", "capacity": 4 }`
- **Behavior**: Automatically generates a unique random hex token representing the QR scan code.

#### `GET /tables`
*List all tables configured inside the restaurant.*

#### `PATCH /tables/:tableId/qr/toggle`
*Enable or disable scanning permissions for a specific table QR.*
- **Body**: `{ "isActive": true || false }`

#### `POST /tables/:tableId/checkout`
*Checkout a table session (releases table back to vacant).*

#### `POST /tables/scan` (Public)
*Customer QR scan endpoint.*
- **Body**: `{ "code": "hex_token", "customerName": "Alice", "numberOfPeople": 2, "deviceId": "client_uuid" }`
- **Response**: Generates table session and locks the session to `Alice`'s device ID. Returns restaurant details, active session details, and the full active menu categories tree.

#### `POST /tables/call` (Public)
*Customer table service call requests.*
- **Body**: `{ "restaurantId": "ID", "tableNumber": "T-1", "serviceType": "water" || "bill" || "cleaning" || "queries" || "others" }`
- **Behavior**: Routes and emits `service_call_received` socket notification to active screens that are configured to listen to this service type and table number.

#### `POST /tables/order` (Public)
*Customer dine-in order placement via QR code session.*
- **Body**:
  ```json
  {
    "code": "qr_hex_token",
    "deviceId": "customer_device_uuid",
    "items": [
      {
        "itemId": "menuItemObjectId",
        "quantity": 2,
        "addOns": [
          { "name": "Extra Guacamole" }
        ]
      }
    ]
  }
  ```
- **Security Guards** (in order):
  1. QR code token must resolve to an existing table.
  2. QR code must have `isActive: true` — rejected with `400` if disabled by staff.
  3. Table must be in `occupied` status with an active customer session — rejected with `400` if no session.
  4. `deviceId` in the request must exactly match the session owner's device — rejected with `403` for foreign devices.
- **Pricing**: All item prices and add-on prices are resolved from the **database source-of-truth**, never from the client request. Client-submitted prices are ignored.
- **Calculations**: `subtotal = Σ (itemPrice + addOnSubtotal) × quantity`, `tax = subtotal × (itemTaxRate / 100)`, `grandTotal = subtotal + tax`. Rounded to 2 decimal places.
- **Behavior**: Commits the order atomically in a database transaction, links the order `_id` to the table's `activeSession.orderIds` array, and broadcasts a real-time `order_created` Socket.io event to all authenticated KDS screens in the restaurant room.
- **Response**: Full order document including `totals`, `orderSource: 'dine_in'`, `tableNumber`, and linked `tableId`.

---

### Menu Catalog & Media

#### `POST /menu/categories`
*Create menu category.*
- **Body**: `{ "name": "Desserts", "description": "Sweet treats" }`
- **Behavior**: Creates category with unique slug validation per restaurant.

#### `DELETE /menu/categories/:categoryId`
*Soft delete category and cascade soft delete to all menu items under it inside a database transaction.*

#### `POST /menu/items`
*Create menu item.*
- **Body**:
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

### Kitchen Display Systems (KDS) & Sockets

#### `POST /screens`
*Create a screen layout terminal.*
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

#### `PATCH /orders/:orderId/status`
*Update order preparation ticket status (Chef/Manager/Owner).*
- **Body**: `{ "status": "accepted" || "preparing" || "completed" || "cancelled" }`
- **Behavior**: Updates DB status and broadcasts `order_updated` socket notification to the restaurant room.

---

### Webhook Integrations

#### `POST /webhooks/swiggy/order` | `POST /webhooks/zomato/order` | `POST /webhooks/magicpin/order`
*Receive external orders from third-party aggregators.*
- **Headers**: Required HMAC-SHA256 signature headers.
- **Behavior**: Verifies signature, transforms payload, runs idempotency checks to block duplicates, saves order in DB, and emits real-time `order_created` websocket alerts.

---

### Platform Integrations & Settings (Module 4)

All endpoints require authentication (`protect`), tenant resolution (`resolveTenant` via `x-restaurant-id` header), and `owner` or `manager` roles.

#### `POST /integrations`
*Configure or onboard a third-party aggregator integration.*
- **Body**:
  ```json
  {
    "platform": "swiggy" || "zomato" || "magicpin",
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
- **Behavior**: Encrypts `credentials.accessToken` and `credentials.refreshToken` using AES-256-GCM before database write. Upserts the platform integration record.

#### `GET /integrations`
*Retrieve active platform integrations configured for the restaurant.*
- **Behavior**: Returns the integration profile. If logged in as an `owner`, decrypts and returns raw tokens. If logged in as a non-owner staff member (e.g. manager/chef/server), redacts access and refresh tokens to `[REDACTED]`.

#### `PATCH /integrations/:id`
*Modify sync settings, toggle credentials, or change status.*
- **Body**: Supports partial updates to `syncSettings`, `status`, `externalRestaurantId`, and `credentials`.

#### `POST /integrations/:id/sync/menu`
*Trigger menu sync simulation.*
- **Behavior**: Verifies that menu sync is enabled. Fetches all restaurant menu items, filters items that are mapped and active for the platform, sets their `platformMappings[platform].syncedAt` to the current time, and updates `lastSyncedAt` on the integration profile.
- **Response**: `{ "syncedItemsCount": X, "lastSyncedAt": "timestamp" }`

---

### Dineout Bookings (Phase 1)

#### `POST /bookings` (Public)
*Create a new table reservation.*
- **Body**:
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
- **Behavior**:
  - Resolves table by `tableNumber` (if provided), validates that capacity fits the party size, and checks for conflicting confirmed bookings for the same date + slot. If a conflict or capacity mismatch occurs, returns `400`.
  - Confirms the booking dynamically (sets `status` to `'confirmed'`).

#### `GET /bookings`
*List bookings for a restaurant.*
- **Headers**: Requires Bearer Token (Owner/Manager/Server/Chef).
- **Query Filters**: `bookingDate`, `status`, `platform`.

#### `PATCH /bookings/:id`
*Modify a booking (update status or table).*
- **Headers**: Requires Bearer Token (Owner/Manager/Server).
- **Body**: Supports updating `status` and `tableNumber`.

#### `POST /bookings/webhooks/dineout/:platform` (Public Webhook)
*Receive reservations from Swiggy/Zomato Dineout integrations.*
- **Behavior**: Runs idempotency validation on `source.externalBookingId`. Resolves table if specified, and inserts a confirmed booking.

---

### Raw Materials & Inventory (Phase 2)

All inventory endpoints require authentication (`protect`) and tenant resolution (`resolveTenant`).

#### `POST /inventory/items`
*Create a new raw material/inventory item.*
- **Headers**: Requires Bearer Token (Owner/Manager).
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

#### `GET /inventory/items`
*Retrieve list of all inventory items and current stock levels.*
- **Headers**: Requires Bearer Token (Owner/Manager/Chef).

#### `POST /inventory/items/:id/adjust`
*Manually adjust stock levels (restock purchase or wastage).*
- **Headers**: Requires Bearer Token (Owner/Manager/Chef).
- **Body**:
  ```json
  {
    "type": "purchase" || "wastage" || "adjustment",
    "quantity": 10,
    "reason": "Restocked for the weekend"
  }
  ```
- **Behavior**: Atomically updates item stock in a transaction and registers a transaction ledger entry in `InventoryTransaction`.

---

### Reputation & Feedbacks (Phase 4)

#### `POST /feedback` (Public)
*Submit internal customer review or complaint.*
- **Body**:
  ```json
  {
    "restaurantId": "restaurantObjectId",
    "customerName": "Sam ColdFood",
    "rating": 2,
    "comment": "French fries were cold.",
    "orderId": "orderObjectId"
  }
  ```
- **Behavior**: Auto-classifies as complaint (`isComplaint: true`, `status: 'pending'`) if `rating <= 2`. Auto-escalates to Owner attention (`escalatedToOwner: true`) if `rating === 1`.

#### `GET /feedback`
*Retrieve logged customer reviews and complaints.*
- **Headers**: Requires Bearer Token (Owner/Manager/Chef/Server).
- **Query Filters**: `source` (internal/swiggy/zomato), `isComplaint`, `status`, `escalatedToOwner`.

#### `GET /feedback/analytics`
*Retrieve restaurant average rating and feedback stats.*
- **Headers**: Requires Bearer Token (Owner/Manager).

#### `PATCH /feedback/:id/resolve`
*Resolve customer complaints.*
- **Headers**: Requires Bearer Token (Owner/Manager).
- **Body**:
  ```json
  {
    "status": "resolved" || "ignored",
    "resolutionNotes": "Refunded the customer and spoke to kitchen staff."
  }
  ```

#### `POST /feedback/sync/:platform`
*Simulate reviews fetch/pull from third party aggregators (Swiggy/Zomato).*
- **Headers**: Requires Bearer Token (Owner/Manager).
- **Behavior**: Verifies that the `PlatformIntegration` configured in Phase 1 is active. Syncs reviews idempotently checking if `externalReviewId` already exists.




