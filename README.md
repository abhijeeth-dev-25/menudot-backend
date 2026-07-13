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
