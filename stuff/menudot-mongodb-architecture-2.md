# Menudot — MongoDB Production Architecture

**Domain:** Multi-tenant restaurant operations platform (dine-in QR ordering + aggregated online orders from Swiggy/Zomato/Magicpin + staff/inventory/finance/booking management)
**Scale target:** thousands of tenants, millions of orders/customers, real-time order + service state.

---

## PHASE 1 — Application Analysis (Summary)

Key facts that drive every modeling decision below:

- **Every restaurant is a tenant.** All operational data (menu, orders, tables, staff, finance, inventory) belongs to exactly one `restaurantId`. This is the single most important design constraint — it becomes the **shard key prefix and the first field of nearly every compound index**.
- **Orders are the hottest write+read path.** They're created constantly, updated in near-real-time (status transitions), read by multiple screens (kitchen, cashier, owner) simultaneously, and queried historically for reports. This demands a schema optimized for both **fast single-order lookups** and **fast recent-order scans per restaurant**.
- **Orders originate from 4+ sources** (Menudot QR, Swiggy, Zomato, Magicpin, future partners) but must be normalized into one internal shape — a **polymorphic "source" sub-document** pattern, not separate collections per platform.
- **Roles are restaurant-scoped, not global.** A user can be Owner of Restaurant A and Server at Restaurant B. This rules out embedding role directly on the `users` document.
- **QR table sessions are ephemeral, high-churn, security-sensitive** (device binding, single active scanner per table) — a strong candidate for **TTL-indexed, short-lived documents**, separate from the permanent `tables` collection.
- **Menu items sync outward to 3 external platforms**, each with platform-specific IDs/pricing/availability overrides — needs an **embedded array of platform mappings** inside `menu_items`, not a join.
- **Finance/inventory/reports are append-heavy, rarely updated, and queried by date range** — classic **time-series / bucketed** pattern candidates.
- **Notifications and service requests are high-volume, short-retention** — TTL candidates.
- **Future AI, franchise/multi-location, and additional delivery partners must not force a schema rewrite** — every collection needs a `source`/`platform` enum discriminator and a `metadata` catch-all object rather than rigid platform-specific fields baked into the schema.

---

## PHASE 2 — Domain Modeling

| Domain | Reason it exists |
|---|---|
| **Identity & Access** | Global user accounts, restaurant-scoped roles, device/screen logins |
| **Tenancy** | The restaurant profile, onboarding, legal/compliance docs, subscription/billing |
| **Menu** | Categories, items, add-ons, platform sync mappings |
| **Ordering** | Unified order pipeline across dine-in + 3rd-party platforms |
| **Dine-in Operations** | Tables, QR sessions, service requests |
| **Staff Operations** | Roles, screens/devices, shift/attendance (future) |
| **Inventory** | Raw materials, stock, consumption, purchases |
| **Finance** | Transactions, salaries, daily rollups, P&L |
| **Bookings** | Dineout reservations (internal + Swiggy/Zomato Dineout) |
| **Growth/Marketing** | Campaigns, ads, sponsored listings |
| **Reputation** | Ratings, reviews, complaints (internal + synced from platforms) |
| **Customer** | Guest/registered customer profile, order history |
| **Integrations** | Per-restaurant credentials/config for external platforms |
| **Notifications** | Real-time event fan-out, delivery tracking |
| **Reporting/Analytics** | Precomputed rollups for dashboards |
| **Audit & Compliance** | Who changed what, when — required for financial + legal data |
| **Media** | Menu images, documents, restaurant photos (metadata; binaries in S3/GCS) |

---

## PHASE 3 & 4 — Collections, Purpose, and Document Models

> Naming convention: snake_case, plural collection names. Every document (unless explicitly noted as embedded-only) carries the **base audit envelope**:

```js
// Shared base fields — present on nearly every top-level document
{
  _id: ObjectId,
  restaurantId: ObjectId,       // tenant scope — indexed on almost everything
  status: "active",             // domain-specific enum
  isDeleted: false,             // soft delete flag
  deletedAt: null,
  createdBy: ObjectId,          // userId or "system"
  updatedBy: ObjectId,
  createdAt: ISODate,
  updatedAt: ISODate,
  version: 1                    // optimistic concurrency / schema version
}
```

---

### 3.1 `restaurants` (Tenant root)

**Purpose:** The tenant record. Owner/business/legal/menu-setup info collected at onboarding. One document = one physical outlet (a chain with 5 branches = 5 `restaurants` docs linked by `chainId`).

**Owner:** Platform admin (approval), Restaurant Owner (edits).
**Access frequency:** Read on every request (tenant context lookup) → **must be cached (Redis) in front of Mongo**, not hit on every API call.

```js
{
  _id: ObjectId,
  chainId: ObjectId | null,          // groups multi-location franchises
  name: "Spice Route",
  slug: "spice-route-hitech-city",   // unique, used in QR URLs
  owner: {
    userId: ObjectId,
    fullName: "Ramesh Kumar",
    email: "ramesh@example.com",
    mobile: "+91XXXXXXXXXX",
    whatsapp: "+91XXXXXXXXXX"
  },
  location: {
    address: "...",
    geo: { type: "Point", coordinates: [78.38, 17.44] }, // GeoJSON
    city: "Hyderabad", state: "Telangana", pincode: "500081"
  },
  schedule: {
    workingDays: ["MON","TUE","WED","THU","FRI","SAT"],
    openTime: "10:00", closeTime: "23:30",
    timezone: "Asia/Kolkata"
  },
  outletType: "dine_in_and_delivery", // enum
  legal: {
    pan: "ENCRYPTED",
    gstin: "ENCRYPTED",
    fssaiNumber: "ENCRYPTED",
    fssaiExpiry: ISODate
  },
  bank: {                             // field-level encrypted (see Phase 14)
    ifsc: "ENCRYPTED", accountNumber: "ENCRYPTED"
  },
  menuProfile: {
    foodType: "both",                 // veg | both
    cuisines: ["North Indian","Chinese"],
    costForTwo: 600,
    packingCharge: { type: "flat", value: 20 }
  },
  commercials: {
    commissionPercent: 18,
    onboardingFeePaid: true,
    termsAcceptedAt: ISODate,
    termsVersion: "v3"
  },
  onboarding: {
    stage: "approved",                // draft|submitted|under_review|approved|rejected
    submittedAt: ISODate,
    approvedAt: ISODate,
    approvedBy: ObjectId,
    rejectionReason: null
  },
  subscription: {
    plan: "growth",
    status: "active",
    renewsAt: ISODate
  },
  isDeleted: false, createdAt: ISODate, updatedAt: ISODate, version: 1
}
```

**Indexes:**
- `{ slug: 1 }` unique — QR/URL resolution
- `{ "location.geo": "2dsphere" }` — "restaurants near me" (future marketplace)
- `{ chainId: 1 }` — franchise rollups
- `{ "onboarding.stage": 1 }` — admin approval queue

**Design note:** Legal/bank fields are stored **encrypted at rest** (Mongo Client-Side Field Level Encryption) and are the one place `restaurantId`-scoped data is *not* freely readable by all restaurant staff — enforced in Phase 14.

---

### 3.2 `users` (Global identity)

**Purpose:** One document per human who can log in — owners, managers, servers, chefs, platform admins. Global because the same phone/email may work across restaurants (e.g., an owner of two branches, or a manager who switches jobs).

```js
{
  _id: ObjectId,
  fullName: "Priya Singh",
  email: "priya@example.com",
  mobile: "+91XXXXXXXXXX",
  passwordHash: "...",
  authProviders: [
    { provider: "menudot", providerId: null },
    { provider: "swiggy", providerId: "swg_9182" }
  ],
  globalRole: "restaurant_user",     // restaurant_user | platform_admin
  status: "active",                  // active|suspended
  lastLoginAt: ISODate,
  isDeleted: false, createdAt: ISODate, updatedAt: ISODate, version: 1
}
```

**Indexes:** `{ email: 1 }` unique sparse, `{ mobile: 1 }` unique sparse, `{ "authProviders.provider": 1, "authProviders.providerId": 1 }`.

---

### 3.3 `restaurant_staff` (Referenced join: user ↔ restaurant ↔ role)

**Purpose:** Because roles are restaurant-scoped and many-to-many (one user, many restaurants; one restaurant, many users), this is a **thin referencing join collection** rather than an embedded array on either side — it avoids unbounded array growth on `restaurants` (a chain could have hundreds of staff) and avoids duplicating role data across many `users` documents.

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  userId: ObjectId,
  role: "chef",                      // owner|manager|server|chef|custom
  permissions: ["orders:read","orders:update_status","menu:update_stock"],
  screenAccess: ["kitchen_display","order_page"],
  employment: {
    joinedAt: ISODate,
    salary: { amount: 18000, currency: "INR", cycle: "monthly" }  // sensitive — see Phase 14
  },
  status: "active",                  // active|suspended|terminated
  isDeleted: false, createdAt: ISODate, updatedAt: ISODate, version: 1
}
```

**Indexes:** `{ restaurantId: 1, userId: 1 }` unique, `{ userId: 1 }` (a user's "which restaurants am I staff at" lookup), `{ restaurantId: 1, role: 1 }`.

---

### 3.4 `screens` (Device logins)

**Purpose:** Owner-provisioned device credentials (Kitchen Display, Cashier, Server tablet). Separate from `users` because a screen is a **shared device identity**, not a person, and needs its own lightweight auth lifecycle (revoke a tablet without touching the staff member's account).

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  name: "Kitchen Display 1",
  screenType: "kitchen_display",     // kitchen_display|cashier|server|owner|reception
  username: "kds1",
  passwordHash: "...",
  assignedRole: "chef",
  permissions: ["orders:read","orders:update_status"],
  lastActiveAt: ISODate,
  status: "active",
  isDeleted: false, createdAt: ISODate, updatedAt: ISODate, version: 1
}
```

**Indexes:** `{ restaurantId: 1, username: 1 }` unique.

---

### 3.5 `menu_categories`

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  name: "Starters",
  sortOrder: 1,
  isActive: true,
  isDeleted: false, createdAt: ISODate, updatedAt: ISODate, version: 1
}
```
**Indexes:** `{ restaurantId: 1, sortOrder: 1 }`.

---

### 3.6 `menu_items`

**Purpose:** Central menu source of truth. Add-ons are **embedded** (small, tightly coupled, always read with the item). Platform-specific mappings are **embedded as an array** rather than a separate collection — they're small, bounded (max ~5 platforms), always fetched with the item, and never queried independently at scale.

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  categoryId: ObjectId,
  name: "Paneer Butter Masala",
  slug: "paneer-butter-masala",
  description: "...",
  foodType: "veg",                   // veg|non_veg|egg
  price: 280,
  currency: "INR",
  images: [{ url: "...", isPrimary: true }],
  ingredients: ["Paneer","Butter","Tomato Gravy"],
  tags: ["bestseller","chef_special"],
  rating: { avg: 4.5, count: 128 },   // denormalized rollup, recomputed async
  addOnGroups: [                      // embedded — small, bounded, always read together
    {
      groupName: "Spice Level",
      required: true,
      maxSelect: 1,
      options: [
        { name: "Mild", priceDelta: 0 },
        { name: "Spicy", priceDelta: 0 }
      ]
    }
  ],
  stock: { inStock: true, autoManaged: false },
  platformMappings: [                 // embedded — bounded array, one entry per external platform
    { platform: "swiggy", externalItemId: "SWG_8891", price: 299, isActive: true, syncedAt: ISODate },
    { platform: "zomato", externalItemId: "ZM_2210", price: 295, isActive: true, syncedAt: ISODate }
  ],
  isDeleted: false, createdAt: ISODate, updatedAt: ISODate, version: 1
}
```

**Indexes:**
- `{ restaurantId: 1, categoryId: 1, isDeleted: 1 }` — menu page load
- `{ restaurantId: 1, "stock.inStock": 1 }` — out-of-stock filtering
- `{ restaurantId: 1, name: "text", tags: "text" }` — customer-facing search
- `{ "platformMappings.platform": 1, "platformMappings.externalItemId": 1 }` — inbound webhook resolves item by external ID

---

### 3.7 `orders` — the core hot-path collection

**Purpose:** Every order regardless of source, normalized into one shape. Order **line items are embedded** (always read/written together, bounded to a few dozen items, never queried independently). Order **status history is embedded as an array** (bounded — a handful of transitions per order) rather than a separate `order_events` collection, because it's always fetched alongside the order and doesn't need independent indexing at scale.

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  orderNumber: "SR-20260712-0417",     // human-readable, per-restaurant sequence
  source: {
    platform: "swiggy",                // menudot_qr | swiggy | zomato | magicpin | future
    externalOrderId: "SWG_ORD_88213",
    tableSessionId: null                // set only when platform === "menudot_qr"
  },
  channel: "delivery",                  // dine_in | delivery | takeaway
  customer: {
    customerId: ObjectId | null,        // ref to customers, null for anonymous 3rd-party orders
    name: "Guest", mobile: "+91XXXXXXXXXX", guestCount: 2
  },
  items: [                              // embedded — always read/written with the order
    {
      menuItemId: ObjectId,
      name: "Paneer Butter Masala",     // denormalized snapshot at order time (price history integrity)
      price: 280,
      quantity: 2,
      addOns: [{ name: "Spicy", priceDelta: 0 }],
      notes: "less spicy",
      kitchenStatus: "preparing"        // pending|preparing|ready|served (per-item, chef updates)
    }
  ],
  pricing: {
    subtotal: 560, tax: 28, serviceCharge: 20, platformCharge: 15,
    discount: 0, couponCode: null, total: 623
  },
  payment: {
    method: "upi", status: "paid", transactionRef: "..."
  },
  status: "preparing",                  // placed|accepted|preparing|ready|served|out_for_delivery|completed|cancelled
  statusHistory: [                      // embedded — small bounded array
    { status: "placed", at: ISODate, by: "system" },
    { status: "accepted", at: ISODate, by: ObjectId },
    { status: "preparing", at: ISODate, by: ObjectId }
  ],
  placedAt: ISODate,
  completedAt: null,
  isDeleted: false, createdAt: ISODate, updatedAt: ISODate, version: 1
}
```

**Indexes:**
- `{ restaurantId: 1, status: 1, placedAt: -1 }` — **the** dashboard query: "active orders for my restaurant"
- `{ restaurantId: 1, placedAt: -1 }` — recent orders / pagination
- `{ "source.platform": 1, "source.externalOrderId": 1 }` unique partial (where externalOrderId exists) — webhook idempotency, prevents duplicate order ingestion
- `{ restaurantId: 1, orderNumber: 1 }` unique
- `{ "customer.customerId": 1, placedAt: -1 }` — customer order history

**Why embed items & status history, not reference:** an order's items never outlive the order, are never queried in isolation across orders at meaningful scale (reporting instead aggregates via `$unwind` on demand), and keeping them embedded means the *entire order* is fetched and written in **one round trip** — critical for a real-time kitchen-display workload where write latency matters. Document size stays small (a few KB) — well inside safe limits.

**Why NOT embed orders inside `tables` or `restaurants`:** orders are high-volume and independently queried/paginated/reported on; embedding would blow past the 16MB document cap and create write contention (many orders hitting one `restaurants` document = a hot document / lock contention risk, discussed in Phase 17).

---

### 3.8 `tables`

**Purpose:** Permanent physical table records — low write frequency, referenced by orders and sessions.

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  tableNumber: "12",
  qrCodeToken: "tbl_9f2ac...",          // static, embedded in printed QR
  capacity: 4,
  zone: "indoor",
  status: "occupied",                    // available|occupied|reserved|inactive
  currentSessionId: ObjectId | null,     // pointer to active table_sessions doc
  isDeleted: false, createdAt: ISODate, updatedAt: ISODate, version: 1
}
```
**Indexes:** `{ restaurantId: 1, tableNumber: 1 }` unique, `{ qrCodeToken: 1 }` unique.

---

### 3.9 `table_sessions` (QR scan sessions — TTL)

**Purpose:** Ephemeral, security-sensitive. Enforces "single active scanner per table," binds device fingerprint, auto-expires. Kept **separate from `tables`** because sessions churn constantly (every dine-in visit) while the table record itself barely changes — separating them avoids rewriting the parent table document on every scan/close cycle.

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  tableId: ObjectId,
  status: "active",                      // active|closed
  scanEnabledBy: ObjectId,               // server who opened scanning
  scannedDevice: { fingerprint: "...", userAgent: "...", ip: "..." },
  guestInfo: { name: "Ravi", guestCount: 3 },
  activeOrderIds: [ObjectId],            // orders placed within this session
  openedAt: ISODate,
  closedAt: null,
  expiresAt: ISODate                     // TTL index target — auto-cleans stale sessions
}
```
**Indexes:**
- `{ tableId: 1, status: 1 }` — enforce "only one active session per table" at the application/transaction layer
- `{ expiresAt: 1 }` **TTL index** — auto-delete abandoned sessions
- `{ "scannedDevice.fingerprint": 1 }` — security/fraud lookups

---

### 3.10 `service_requests`

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  tableId: ObjectId,
  sessionId: ObjectId,
  type: "water",                         // water|bill|cleaning|assistance|other
  note: "",
  status: "pending",                     // pending|acknowledged|resolved
  raisedAt: ISODate,
  resolvedAt: null,
  resolvedBy: ObjectId | null,
  createdAt: ISODate
}
```
**Indexes:** `{ restaurantId: 1, status: 1, raisedAt: -1 }`.

---

### 3.11 `notifications`

**Purpose:** Fan-out feed per restaurant/screen. High write volume, short retention → TTL.

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  audience: { screenIds: [ObjectId], roles: ["chef"] },
  type: "order_placed",                  // order_placed|order_status|service_request|booking|inventory_alert|platform_sync
  title: "New order #SR-0417",
  payload: { orderId: ObjectId },
  readBy: [ObjectId],
  createdAt: ISODate,
  expiresAt: ISODate                     // TTL index
}
```
**Indexes:** `{ restaurantId: 1, createdAt: -1 }`, `{ expiresAt: 1 }` TTL.

---

### 3.12 `inventory_items`

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  name: "Paneer", unit: "kg",
  currentStock: 12.5,
  reorderThreshold: 5,
  linkedMenuItems: [ObjectId],           // for auto stock-out propagation (future)
  isDeleted: false, createdAt: ISODate, updatedAt: ISODate, version: 1
}
```
**Indexes:** `{ restaurantId: 1, currentStock: 1, reorderThreshold: 1 }` — low-stock alert scan.

### 3.13 `inventory_transactions`

**Purpose:** Append-only ledger (purchase, consumption, waste). **Referenced**, not embedded in `inventory_items`, because it's an unbounded, time-series log.

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  inventoryItemId: ObjectId,
  type: "purchase",                      // purchase|consumption|waste|adjustment
  quantity: 10, unitCost: 320,
  reference: { orderId: null, purchaseInvoice: "INV-2201" },
  recordedAt: ISODate,
  recordedBy: ObjectId,
  createdAt: ISODate
}
```
**Indexes:** `{ restaurantId: 1, inventoryItemId: 1, recordedAt: -1 }`.

---

### 3.14 `finance_transactions`

**Purpose:** Append-only financial ledger — bills, salaries, expenses. Never updated after write (corrections are new reversing entries), which is why it's a pure **referenced, immutable, time-bucketed** collection.

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  type: "expense",                       // revenue|expense|salary|refund
  category: "raw_materials",
  amount: 4500, currency: "INR",
  reference: { orderId: null, staffId: null, invoiceNo: "INV-2201" },
  transactionDate: ISODate,
  createdBy: ObjectId,
  createdAt: ISODate
}
```
**Indexes:** `{ restaurantId: 1, transactionDate: -1 }`, `{ restaurantId: 1, type: 1, transactionDate: -1 }`.

### 3.15 `daily_reports` (precomputed rollups)

**Purpose:** Dashboards need instant "today's revenue," "this month's P&L." Rather than aggregating raw `orders`/`finance_transactions` on every dashboard load, a **scheduled job writes one bucketed document per restaurant per day** — the standard MongoDB time-series/bucket pattern for analytics at scale.

```js
{
  _id: ObjectId,                         // or composite: `${restaurantId}_${date}`
  restaurantId: ObjectId,
  date: "2026-07-12",
  orders: { total: 142, dineIn: 60, delivery: 82, cancelled: 4 },
  revenue: { gross: 68400, tax: 3420, net: 64980 },
  expenses: 12000,
  topItems: [{ menuItemId: ObjectId, name: "...", qtySold: 38 }],
  computedAt: ISODate
}
```
**Indexes:** `{ restaurantId: 1, date: -1 }` unique.

---

### 3.16 `bookings` (Dineout)

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  source: { platform: "zomato_dineout", externalBookingId: "ZD_991" },
  customer: { name: "...", mobile: "...", partySize: 4 },
  tableId: ObjectId | null,
  bookingDate: "2026-07-15", bookingTime: "20:00",
  charges: { prebooking: 200, currency: "INR" },
  status: "confirmed",                   // pending|confirmed|seated|completed|cancelled|no_show
  isDeleted: false, createdAt: ISODate, updatedAt: ISODate, version: 1
}
```
**Indexes:** `{ restaurantId: 1, bookingDate: 1, status: 1 }`, `{ "source.platform": 1, "source.externalBookingId": 1 }` unique partial.

---

### 3.17 `campaigns` (Growth/Ads)

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  type: "self_ad",                       // self_ad|sponsored_listing
  title: "20% off weekdays",
  targeting: { customerAppPlacement: true },
  budget: { amount: 2000, spent: 340 },
  schedule: { startAt: ISODate, endAt: ISODate },
  status: "active",
  isDeleted: false, createdAt: ISODate, updatedAt: ISODate, version: 1
}
```
**Indexes:** `{ restaurantId: 1, status: 1 }`, `{ "schedule.startAt": 1, "schedule.endAt": 1 }`.

---

### 3.18 `ratings_reviews`

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  source: { platform: "menudot", externalReviewId: null },
  orderId: ObjectId | null,
  customerId: ObjectId | null,
  rating: 4.5,
  comment: "Great food!",
  itemRatings: [{ menuItemId: ObjectId, rating: 5 }],
  createdAt: ISODate
}
```
**Indexes:** `{ restaurantId: 1, createdAt: -1 }`, `{ "itemRatings.menuItemId": 1 }`.

### 3.19 `complaints`

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  orderId: ObjectId | null,
  customerId: ObjectId | null,
  subject: "Wrong item delivered",
  description: "...",
  status: "open",                        // open|in_progress|resolved|closed
  resolution: null,
  createdAt: ISODate, updatedAt: ISODate
}
```
**Indexes:** `{ restaurantId: 1, status: 1, createdAt: -1 }`.

---

### 3.20 `customers`

**Purpose:** Cross-restaurant customer identity (a diner visits many restaurants). Order history is **referenced** (query `orders` by `customer.customerId`), not embedded, since it's unbounded.

```js
{
  _id: ObjectId,
  name: "Ravi Teja",
  mobile: "+91XXXXXXXXXX",
  email: null,
  favoriteRestaurantIds: [ObjectId],
  loyalty: { points: 120 },              // future
  isDeleted: false, createdAt: ISODate, updatedAt: ISODate
}
```
**Indexes:** `{ mobile: 1 }` unique sparse.

---

### 3.21 `platform_integrations`

**Purpose:** Per-restaurant credentials/config for Swiggy/Zomato/Magicpin. Isolated collection (not embedded in `restaurants`) because secrets need **tighter access control and independent rotation** without touching the frequently-read tenant document.

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  platform: "swiggy",
  externalRestaurantId: "SWG_REST_881",
  credentials: { accessTokenEnc: "ENCRYPTED", refreshTokenEnc: "ENCRYPTED", expiresAt: ISODate },
  syncSettings: { menuSync: true, orderSync: true, autoAcceptOrders: false },
  status: "connected",                   // connected|disconnected|error
  lastSyncedAt: ISODate,
  isDeleted: false, createdAt: ISODate, updatedAt: ISODate, version: 1
}
```
**Indexes:** `{ restaurantId: 1, platform: 1 }` unique.

---

### 3.22 `audit_logs`

**Purpose:** Immutable, append-only, write-once record of sensitive mutations (financial edits, staff role changes, legal-doc edits, deletions). Kept **fully separate** from operational collections and never updated.

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  actorId: ObjectId,
  actorType: "user",                     // user|screen|system|webhook
  action: "menu_item.price_updated",
  entity: { collection: "menu_items", id: ObjectId },
  before: { price: 260 },
  after: { price: 280 },
  ip: "...",
  at: ISODate
}
```
**Indexes:** `{ restaurantId: 1, at: -1 }`, `{ "entity.collection": 1, "entity.id": 1, at: -1 }`.
**Retention:** capped by TTL per compliance policy (e.g., 3–7 years for financial actions, shorter for operational ones) — see Phase 16.

---

### 3.23 `media_assets`

```js
{
  _id: ObjectId,
  restaurantId: ObjectId,
  ownerType: "menu_item",                // restaurant|menu_item|dish_upload|document
  ownerId: ObjectId,
  url: "https://cdn.../...",
  type: "image",                          // image|pdf|doc
  sizeBytes: 128000,
  createdAt: ISODate
}
```
**Indexes:** `{ restaurantId: 1, ownerType: 1, ownerId: 1 }`.
Binary bytes live in object storage (S3/GCS); Mongo stores only metadata/URLs — never store binary blobs in operational documents.

---

## PHASE 5 & 6 — Embedding vs. Referencing Summary

| Relationship | Decision | Why |
|---|---|---|
| Restaurant → Menu Categories/Items | Reference | Unbounded growth, independently queried/paginated |
| Menu Item → Add-ons | Embed | Small, bounded, always read with the item |
| Menu Item → Platform Mappings | Embed | Bounded (~5), always fetched with item |
| Order → Line Items | Embed | Bounded, atomic read/write unit, never queried standalone at scale |
| Order → Status History | Embed | Small bounded array, always read with order |
| Restaurant ↔ Staff (Users) | Reference (join collection `restaurant_staff`) | Many-to-many, avoids unbounded arrays on either side |
| Table → Sessions | Reference | High churn; embedding would force constant rewrites of the low-churn `tables` doc |
| Table Session → Orders | Reference (array of IDs) | Orders are independently large/queried documents |
| Inventory Item → Transactions | Reference | Unbounded time-series ledger |
| Restaurant → Finance Transactions | Reference | Unbounded, immutable ledger, queried by date range |
| Customer → Orders | Reference | Unbounded order history across restaurants |
| Restaurant → Platform Integration Credentials | Reference (separate collection) | Tighter access control, independent of hot-read tenant doc |

**Rule of thumb applied throughout:** embed when data is (a) bounded in size, (b) always accessed together with the parent, and (c) doesn't need independent indexing/pagination at scale. Reference everything else — especially anything append-only/time-series or many-to-many.

---

## PHASE 7 — Index Design Highlights

Beyond the per-collection indexes listed above, platform-wide index principles:

- **Every tenant-scoped collection's first compound index field is `restaurantId`** — this is what makes tenant queries selective and (later) what aligns with the shard key.
- **Partial indexes** for optional-uniqueness fields, e.g. `orders` external-ID uniqueness only applies `{ "source.externalOrderId": { $exists: true } }` — QR orders have no external ID and shouldn't collide on `null`.
- **TTL indexes**: `table_sessions.expiresAt`, `notifications.expiresAt` — automatic cleanup, no cron jobs needed.
- **Text indexes**: `menu_items` name/tags for customer search.
- **Geospatial**: `restaurants.location.geo` (2dsphere) for future "restaurants near me."
- **Sparse indexes**: `users.email`, `users.mobile` — not every user has both.
- Compound indexes are ordered **equality → sort → range** (ESR rule), e.g. `{ restaurantId: 1, status: 1, placedAt: -1 }` supports "active orders, most recent first" without an in-memory sort.
- Avoid over-indexing collections with heavy write volume (`orders`, `notifications`) — each extra index adds write overhead; only indexes backing an actual query pattern are added.

---

## PHASE 8 — Query Optimization Patterns

- **Dashboard "live orders" view**: single index-covered query `{ restaurantId, status: {$in:[...active statuses]} }` sorted by `placedAt` — no aggregation needed at request time.
- **Reporting/analytics**: never aggregate raw `orders` for dashboard loads — read from precomputed `daily_reports`. Raw aggregation is reserved for ad-hoc/custom date-range reports, run against `orders`/`finance_transactions` with `restaurantId` + date-range bounds always as the first `$match` stage.
- **Pagination**: cursor-based (`_id` or `placedAt` range) rather than `skip/limit` for large order histories, to avoid skip-scan cost.
- **Search**: `menu_items` text index for customer-facing search; consider Atlas Search if fuzzy/typo-tolerant search becomes a requirement.
- **Webhook ingestion (Swiggy/Zomato/Magicpin)**: idempotent upserts keyed on `{ "source.platform", "source.externalOrderId" }` to survive retried webhooks.

---

## PHASE 9 — Schema Evolution

- Every document carries a `version` field for optimistic-concurrency and schema-migration tracking.
- New optional fields are additive-only in application code (Mongoose `strict: false` combined with **JSON Schema validation** listing only currently-required fields — see Phase 14).
- Structural changes (e.g., new order source) use a `metadata: {}` catch-all field on new platform types rather than adding one field per platform to the top-level schema.
- Background migration scripts run in batches (`bulkWrite`) scoped by `restaurantId` range to avoid long-running global table scans.

---

## PHASE 10 — Performance at Scale

- **Document size discipline**: `orders` stay in the low KBs (items array bounded to realistic order sizes); nothing approaches the 16MB cap.
- **Working set**: hot data is recent (open) orders + today's sessions/notifications — TTL and status-based indexes keep the "hot" working set small relative to total historical data, so it fits in RAM even as history grows into the billions of documents.
- **Connection pooling**: application-tier pool sized per Node.js instance (e.g., 50–100 per pod) with the driver's built-in pool; avoid one connection per request.
- **Batch writes**: inventory consumption and finance postings triggered by an order use `bulkWrite`/multi-document transactions (Phase 13) rather than N sequential writes.
- **Aggregation optimization**: `$match` on `restaurantId` (+ indexed fields) as the very first pipeline stage always; `$project` early to shrink documents flowing through later stages.

---

## PHASE 11 — Sharding

**Is sharding required initially?** No — a well-indexed replica set comfortably handles "thousands of restaurants / millions of orders" (low-to-mid tens of millions of documents in the largest collections). Sharding is planned for, not switched on day one, to avoid unnecessary operational complexity.

**When triggered (roadmap):** once `orders`/`finance_transactions`/`notifications` approach hundreds of millions of documents or working-set-exceeds-RAM.

**Shard key:** `{ restaurantId: 1, _id: 1 }` (hashed on `restaurantId`, or a compound hashed key) for `orders`, `notifications`, `finance_transactions`, `inventory_transactions`.

- **Why `restaurantId`-based:** virtually every query is already scoped by `restaurantId` (tenant isolation) — this makes shard-targeted (non-scatter-gather) queries the default, and keeps a tenant's data co-located, which also simplifies backup/restore-per-tenant.
- **Hot-partition risk:** a small number of very high-volume chains could dominate a shard. Mitigate with **hashed sharding on `restaurantId`** (distributes even large tenants' data appropriately) rather than ranged sharding, and monitor chunk distribution for chains that vastly outscale typical restaurants — those can be given a compound key `{ restaurantId, _id }` to spread a single large tenant's writes across chunks.
- **Collections that stay unsharded:** `restaurants`, `users`, `menu_categories`, `menu_items` — far smaller in volume, don't need it, and unsharded collections are simpler to manage/query flexibly.

---

## PHASE 12 — Replication

- Minimum **3-node replica set** per environment (primary + 2 secondaries) for automatic failover; production recommends a 5-node set spanning availability zones.
- **Write concern:** `{ w: "majority" }` for orders, payments, finance — correctness over raw speed. Lower-durability `{ w: 1 }` acceptable for `notifications` (best-effort, TTL-bound anyway).
- **Read preference:** `primary` for order-status and payment reads (must be current); `secondaryPreferred` for reporting/analytics aggregations to offload the primary.
- **Elections:** automatic on primary failure; app-tier driver retries handle the brief unavailability window transparently (retryable writes enabled).

---

## PHASE 13 — Transactions

Multi-document ACID transactions used **only** where multiple collections must change atomically and inconsistency would be a real business problem:

- **Order placement → inventory deduction** (when `autoManaged` stock is on): update `orders` (create) + `inventory_items` (decrement) + `inventory_transactions` (log) in one transaction.
- **Order completion → finance posting**: create `finance_transactions` revenue entry tied to the order.
- **Table session close + table status update**: `table_sessions.status = closed` + `tables.status = available` + `tables.currentSessionId = null`.

**Avoided elsewhere:** simple single-document updates (order status change, stock toggle, notification read receipt) rely on MongoDB's native single-document atomicity — no transaction needed, keeping write latency low on the hottest paths.

---

## PHASE 14 — Security

- **AuthN**: JWT-based sessions for `users` and `screens`, short-lived access tokens + refresh tokens.
- **AuthZ**: enforced at the application layer using `restaurant_staff.permissions` / `screens.permissions` — every query is additionally scoped by `restaurantId` derived from the authenticated session, never trusted from client input.
- **Field-level encryption**: PAN, GSTIN, FSSAI number, bank account/IFSC, and platform integration tokens use **MongoDB Client-Side Field Level Encryption (CSFLE)** — encrypted before leaving the app, unreadable even to a database administrator.
- **PII minimization**: customer mobile/email indexed but never logged in plaintext in `audit_logs`; audit `before/after` snapshots redact sensitive fields.
- **Collection-level access**: database users/roles scoped so that, e.g., a reporting service account has read-only access and no access to `platform_integrations` credentials or `restaurants.bank`.
- **Audit logging**: every mutation to legal docs, bank details, staff roles, and financial records writes an `audit_logs` entry (Phase 3.22).
- **Rate limiting / abuse**: QR `table_sessions` device-fingerprint binding + single-active-session-per-table enforced transactionally to prevent session hijacking.

---

## PHASE 15 — Multi-Tenancy Strategy

**Chosen approach: shared collections with a mandatory `restaurantId` field, enforced isolation at the query/index layer** (not separate databases or collections per tenant).

| Approach | Verdict |
|---|---|
| Separate database per restaurant | ❌ Rejected — thousands of tenants means thousands of databases; connection/pool overhead, painful cross-tenant admin reporting, no benefit over indexed sharing at this data sensitivity level |
| Separate collections per restaurant | ❌ Rejected — same operational overhead, plus schema drift risk across per-tenant collections |
| **Shared collections, `restaurantId`-scoped** | ✅ Chosen — simplest ops, best index/shard alignment, easiest cross-tenant analytics for the platform itself, standard SaaS pattern at this scale |
| Hybrid (shared normally, dedicated DB for enterprise/franchise tier) | 🔜 Reserved as a future option for very large enterprise customers with contractual data-isolation requirements — not needed at current scale |

Enforcement: every repository-layer query function requires `restaurantId` as a mandatory parameter (never optional), and integration tests assert no cross-tenant leakage.

---

## PHASE 16 — Data Lifecycle

- **Soft delete** (`isDeleted`, `deletedAt`) on all operational/master-data collections (`restaurants`, `menu_items`, `staff`, `tables`, etc.) — supports undo, audit, and referential safety.
- **Hard delete**: only via a scheduled purge job for genuinely ephemeral data — expired `table_sessions`/`notifications` (TTL-driven), and soft-deleted records past a retention window (e.g., 90 days) via a batch job.
- **Archiving**: `orders`/`finance_transactions` older than N months (e.g., 18) move to a cold-storage collection or object-storage export (Parquet/JSON on S3) for cost efficiency, queried via a separate reporting pipeline rather than the hot cluster.
- **Backups**: continuous cloud backups (Atlas) with point-in-time restore; nightly logical snapshot exports of tenant-critical collections.
- **Retention**: financial/audit data retained per local tax/compliance law (commonly 6–7 years in India); operational logs (notifications, sessions) retained days-to-weeks only.

---

## PHASE 17 — Failure Analysis

| Risk | Mitigation |
|---|---|
| Duplicate order ingestion from webhook retries | Idempotent upsert on `{source.platform, source.externalOrderId}` unique partial index |
| Race condition: two servers scan same table simultaneously | Transactional check-and-set on `tables.currentSessionId` + unique active-session enforcement |
| Lost update: two staff edit same order concurrently | Optimistic concurrency via `version` field; reject stale writes |
| Hot document: single `restaurants` doc getting hammered by every order write | Avoided by design — orders never embed into `restaurants`; tenant doc is read-mostly and cacheable |
| Large/unbounded arrays (e.g., item add-ons growing indefinitely) | Application-level caps (e.g., max 20 add-on options) enforced at write time |
| Broken references (order points to deleted menu item) | Order line items **snapshot** name/price at order time — orders never depend on `menu_items` staying unchanged |
| Inconsistent inventory after failed multi-step write | Wrapped in a transaction (Phase 13); on abort, nothing partially commits |
| Recovery | Point-in-time restore from continuous backups + replaying `audit_logs`/idempotent webhook logs for the affected window |

---

## PHASE 18 — Relationship Diagram (textual ER)

```
restaurants ──1:N── menu_categories ──1:N── menu_items
restaurants ──1:N── restaurant_staff ──N:1── users
restaurants ──1:N── screens
restaurants ──1:N── tables ──1:N── table_sessions ──1:N── orders (via activeOrderIds)
restaurants ──1:N── orders ──[embedded]── items, statusHistory
restaurants ──1:N── inventory_items ──1:N── inventory_transactions
restaurants ──1:N── finance_transactions
restaurants ──1:N── bookings
restaurants ──1:N── campaigns
restaurants ──1:N── ratings_reviews / complaints
restaurants ──1:N── platform_integrations
customers ──1:N── orders (cross-restaurant reference)
orders ──1:1── finance_transactions (revenue posting, referenced by orderId)
audit_logs ──N:1── (any collection, polymorphic via entity.collection/id)
```

---

## PHASE 19 — Backend Integration (Node.js + Express + Mongoose)

```
src/
  config/
    db.js                  # connection, pool size, retryWrites
    encryption.js           # CSFLE key vault setup
  models/
    base/
      auditablePlugin.js    # mongoose plugin adding createdAt/updatedAt/version/soft-delete
    restaurant.model.js
    user.model.js
    restaurantStaff.model.js
    screen.model.js
    menuCategory.model.js
    menuItem.model.js
    order.model.js
    table.model.js
    tableSession.model.js
    serviceRequest.model.js
    notification.model.js
    inventoryItem.model.js
    inventoryTransaction.model.js
    financeTransaction.model.js
    dailyReport.model.js
    booking.model.js
    campaign.model.js
    ratingReview.model.js
    complaint.model.js
    customer.model.js
    platformIntegration.model.js
    auditLog.model.js
    mediaAsset.model.js
  repositories/
    order.repository.js     # every method requires restaurantId param
    ...
  services/
    orderService.js         # business logic, transaction orchestration
    webhookService.js        # idempotent ingestion from Swiggy/Zomato/Magicpin
  validators/
    order.schema.js          # Joi/Zod request validation, separate from Mongoose schema
```

**Reusable base plugin** (attached to every model):

```js
// models/base/auditablePlugin.js
module.exports = function auditablePlugin(schema) {
  schema.add({
    restaurantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId },
    updatedBy: { type: mongoose.Schema.Types.ObjectId },
    version: { type: Number, default: 1 }
  }, timestamps: true);

  schema.pre(/^find/, function (next) {
    if (!this.getOptions().includeDeleted) this.where({ isDeleted: false });
    next();
  });
};
```

**Repository pattern**: every repository method's first parameter is `restaurantId` — makes cross-tenant leakage a compile-time-visible smell, and centralizes the "always scope by tenant" rule in one layer instead of scattering `.find({...})` calls across controllers.

**Validation strategy**: two layers — (1) Mongoose/MongoDB **JSON Schema validation** at the collection level as a last-resort data-integrity guard, (2) Joi/Zod at the API boundary for rich, user-facing validation errors. The DB-level schema is intentionally looser (only truly required fields) to keep Phase 9's evolution story painless.

---

## PHASE 20 — Self-Review

**Strengths:**
- Every collection's primary index leads with `restaurantId`, giving a clean, low-risk path to sharding later without redesign.
- Hot-path (`orders`) is optimized for single-round-trip reads/writes via embedding, while genuinely unbounded data (finance, inventory logs, staff joins) is correctly referenced.
- TTL indexes remove an entire category of manual cleanup jobs for sessions/notifications.

**Weaknesses / open risks:**
- **`restaurant_staff.employment.salary`** is sensitive and currently only protected by app-layer authorization — if compliance requirements tighten, this should move to field-level encryption like `restaurants.bank`.
- **Denormalized `menu_items.rating`** and **`daily_reports`** rollups can drift from source-of-truth if the recompute job fails silently — needs a reconciliation/alerting job, not just a cron.
- **Franchise/chain reporting** (`chainId` roll-ups across restaurants) isn't fully modeled yet — today it requires an application-layer fan-out query across `restaurants` with matching `chainId`; if chains grow large, a dedicated `chain_daily_reports` rollup (mirroring `daily_reports`) should be added.
- **Large enterprise tenants** (very high order volume, e.g. big QSR chains) may eventually need the hybrid multi-tenancy escape hatch discussed in Phase 15 sooner than expected — worth monitoring per-tenant document counts as an early warning signal.
- **AI features** (Phase roadmap) will likely need a new `ai_interactions`/`embeddings` collection with vector search indexes (Atlas Vector Search) — not designed here since requirements aren't concrete yet, but the `metadata` catch-all pattern used throughout will ease that addition.

**Alternative considered and rejected:** storing `order.items` as references to a separate `order_items` collection (more "normalized"). Rejected because it would require a second round trip on every order create/read — directly hurting the platform's most latency-sensitive workload — for a benefit (independent item querying) that reporting can already get via aggregation `$unwind`, which is run far less frequently than order reads/writes.
