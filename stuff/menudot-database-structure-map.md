# Menudot — Database Structure Map

A file-tree view of the whole database: **1 database → 14 domain folders → 23 collections → ~268 fields**, plus the optimized, dependency-safe order to actually create it in.

---

## 0. Quick Stats

| Metric | Count |
|---|---|
| Database | 1 (`menudot`) |
| Domain groupings (folders) | 14 |
| Collections (files) | 23 |
| Total top-level fields (all collections) | ~268 |
| Fields behind field-level encryption 🔒 | 6 (`restaurants.legal`, `restaurants.bank`, `platform_integrations.credentials`) |
| TTL (self-expiring) collections ⏱ | 2 (`table_sessions`, `notifications`) |
| Collections needed at day 1 (no sharding) | 23 / 23 |
| Collections planned for future sharding | 4 (`orders`, `notifications`, `finance_transactions`, `inventory_transactions`) |

**Estimated document volume at target scale** (thousands of restaurants, millions of customers):

| Volume class | Collections |
|---|---|
| 🟢 Small (hundreds – tens of thousands) | `restaurants`, `platform_integrations` |
| 🟡 Medium (tens of thousands – millions) | `users`, `restaurant_staff`, `screens`, `menu_categories`, `menu_items`, `tables`, `inventory_items`, `campaigns`, `bookings` |
| 🔴 Large (millions – hundreds of millions) | `orders`, `table_sessions`⏱, `service_requests`, `notifications`⏱, `inventory_transactions`, `finance_transactions`, `ratings_reviews`, `complaints`, `customers`, `audit_logs`, `media_assets` |
| 📊 Fixed-rate (1/restaurant/day) | `daily_reports` |

---

## 1. Full Structure Tree

```
menudot/  (database)
│
├── 📁 01_identity-and-tenancy/                              4 collections · 57 fields
│   │
│   ├── 📄 restaurants                    🟢 ~1K–50K docs · 18 fields
│   │   ├── _id                  ObjectId
│   │   ├── chainId               ObjectId | null
│   │   ├── name                  String
│   │   ├── slug                  String  (unique)
│   │   ├── owner                 Object   → userId, fullName, email, mobile, whatsapp
│   │   ├── location              Object   → address, geo (2dsphere), city, state, pincode
│   │   ├── schedule               Object   → workingDays[], openTime, closeTime, timezone
│   │   ├── outletType             Enum
│   │   ├── legal 🔒                Object   → pan, gstin, fssaiNumber, fssaiExpiry
│   │   ├── bank 🔒                 Object   → ifsc, accountNumber
│   │   ├── menuProfile            Object   → foodType, cuisines[], costForTwo, packingCharge
│   │   ├── commercials            Object   → commissionPercent, onboardingFeePaid, termsAcceptedAt, termsVersion
│   │   ├── onboarding             Object   → stage, submittedAt, approvedAt, approvedBy, rejectionReason
│   │   ├── subscription           Object   → plan, status, renewsAt
│   │   ├── isDeleted              Boolean
│   │   ├── createdAt              Date
│   │   ├── updatedAt              Date
│   │   └── version                Number
│   │
│   ├── 📄 users                          🟡 ~5K–200K docs · 13 fields
│   │   ├── _id, fullName, email, mobile, passwordHash
│   │   ├── authProviders          Array<{provider, providerId}>
│   │   ├── globalRole             Enum
│   │   ├── status                 Enum
│   │   ├── lastLoginAt            Date
│   │   └── isDeleted, createdAt, updatedAt, version
│   │
│   ├── 📄 restaurant_staff               🟡 ~10K–500K docs · 12 fields   (join: user ↔ restaurant ↔ role)
│   │   ├── _id, restaurantId, userId, role
│   │   ├── permissions            Array<String>
│   │   ├── screenAccess           Array<String>
│   │   ├── employment 🔒           Object → joinedAt, salary
│   │   └── status, isDeleted, createdAt, updatedAt, version
│   │
│   └── 📄 screens                        🟡 ~5K–150K docs · 14 fields    (device logins)
│       ├── _id, restaurantId, name, screenType, username, passwordHash
│       ├── assignedRole, permissions[]
│       └── lastActiveAt, status, isDeleted, createdAt, updatedAt, version
│
├── 📁 02_menu/                                               2 collections · 29 fields
│   │
│   ├── 📄 menu_categories                🟡 ~10K–500K docs · 9 fields
│   │   └── _id, restaurantId, name, sortOrder, isActive, isDeleted, createdAt, updatedAt, version
│   │
│   └── 📄 menu_items                     🟡 ~100K–5M docs · 20 fields
│       ├── _id, restaurantId, categoryId, name, slug, description
│       ├── foodType, price, currency
│       ├── images                 Array<{url, isPrimary}>
│       ├── ingredients             Array<String>
│       ├── tags                   Array<String>
│       ├── rating                 Object → avg, count
│       ├── addOnGroups            Array<{groupName, required, maxSelect, options[]}>
│       ├── stock                  Object → inStock, autoManaged
│       ├── platformMappings       Array<{platform, externalItemId, price, isActive, syncedAt}>
│       └── isDeleted, createdAt, updatedAt, version
│
├── 📁 03_ordering/                                           1 collection · 17 fields   ⭐ hottest path
│   │
│   └── 📄 orders                         🔴 ~1M–500M+ docs · 17 fields
│       ├── _id, restaurantId, orderNumber
│       ├── source                 Object → platform, externalOrderId, tableSessionId
│       ├── channel                Enum
│       ├── customer               Object → customerId, name, mobile, guestCount
│       ├── items                  Array<{menuItemId, name, price, quantity, addOns[], notes, kitchenStatus}>  [embedded]
│       ├── pricing                Object → subtotal, tax, serviceCharge, platformCharge, discount, couponCode, total
│       ├── payment                Object → method, status, transactionRef
│       ├── status                 Enum
│       ├── statusHistory          Array<{status, at, by}>  [embedded]
│       ├── placedAt, completedAt  Date
│       └── isDeleted, createdAt, updatedAt, version
│
├── 📁 04_dine-in-operations/                                 3 collections · 34 fields
│   │
│   ├── 📄 tables                         🟡 ~20K–1M docs · 12 fields
│   │   └── _id, restaurantId, tableNumber, qrCodeToken, capacity, zone, status, currentSessionId, isDeleted, createdAt, updatedAt, version
│   │
│   ├── 📄 table_sessions ⏱ TTL           🔴 high churn, auto-purged · 11 fields
│   │   ├── _id, restaurantId, tableId, status, scanEnabledBy
│   │   ├── scannedDevice           Object → fingerprint, userAgent, ip
│   │   ├── guestInfo               Object → name, guestCount
│   │   ├── activeOrderIds          Array<ObjectId>
│   │   └── openedAt, closedAt, expiresAt (TTL)
│   │
│   └── 📄 service_requests               🔴 ~millions/yr · 11 fields
│       └── _id, restaurantId, tableId, sessionId, type, note, status, raisedAt, resolvedAt, resolvedBy, createdAt
│
├── 📁 05_notifications/                                      1 collection · 9 fields
│   │
│   └── 📄 notifications ⏱ TTL            🔴 very high volume, auto-purged · 9 fields
│       ├── _id, restaurantId
│       ├── audience               Object → screenIds[], roles[]
│       ├── type, title
│       ├── payload                Object (polymorphic)
│       ├── readBy                 Array<ObjectId>
│       └── createdAt, expiresAt (TTL)
│
├── 📁 06_inventory/                                          2 collections · 21 fields
│   │
│   ├── 📄 inventory_items                🟡 ~50K–2M docs · 11 fields
│   │   └── _id, restaurantId, name, unit, currentStock, reorderThreshold, linkedMenuItems[], isDeleted, createdAt, updatedAt, version
│   │
│   └── 📄 inventory_transactions         🔴 ~millions (append-only ledger) · 10 fields
│       ├── _id, restaurantId, inventoryItemId, type, quantity, unitCost
│       ├── reference              Object → orderId, purchaseInvoice
│       └── recordedAt, recordedBy, createdAt
│
├── 📁 07_finance-and-reporting/                              2 collections · 18 fields
│   │
│   ├── 📄 finance_transactions           🔴 ~millions (append-only ledger) · 10 fields
│   │   ├── _id, restaurantId, type, category, amount, currency
│   │   ├── reference              Object → orderId, staffId, invoiceNo
│   │   └── transactionDate, createdBy, createdAt
│   │
│   └── 📄 daily_reports                  📊 1/restaurant/day · 8 fields  (precomputed rollup)
│       ├── _id, restaurantId, date
│       ├── orders                 Object → total, dineIn, delivery, cancelled
│       ├── revenue                Object → gross, tax, net
│       ├── expenses               Number
│       ├── topItems               Array<{menuItemId, name, qtySold}>
│       └── computedAt
│
├── 📁 08_bookings/                                           1 collection · 13 fields
│   │
│   └── 📄 bookings                       🟡 ~100K–10M docs · 13 fields
│       ├── _id, restaurantId
│       ├── source                 Object → platform, externalBookingId
│       ├── customer               Object → name, mobile, partySize
│       ├── tableId, bookingDate, bookingTime
│       ├── charges                Object → prebooking, currency
│       └── status, isDeleted, createdAt, updatedAt, version
│
├── 📁 09_growth/                                             1 collection · 12 fields
│   │
│   └── 📄 campaigns                      🟡 ~10K–500K docs · 12 fields
│       ├── _id, restaurantId, type, title
│       ├── targeting              Object
│       ├── budget                 Object → amount, spent
│       ├── schedule               Object → startAt, endAt
│       └── status, isDeleted, createdAt, updatedAt, version
│
├── 📁 10_reputation/                                         2 collections · 19 fields
│   │
│   ├── 📄 ratings_reviews                🔴 ~millions · 9 fields
│   │   ├── _id, restaurantId
│   │   ├── source                 Object → platform, externalReviewId
│   │   ├── orderId, customerId, rating, comment
│   │   ├── itemRatings             Array<{menuItemId, rating}>
│   │   └── createdAt
│   │
│   └── 📄 complaints                     🔴 ~100K–5M docs · 10 fields
│       └── _id, restaurantId, orderId, customerId, subject, description, status, resolution, createdAt, updatedAt
│
├── 📁 11_customer/                                           1 collection · 9 fields
│   │
│   └── 📄 customers                      🔴 ~1M–50M docs (cross-restaurant) · 9 fields
│       ├── _id, name, mobile, email
│       ├── favoriteRestaurantIds  Array<ObjectId>
│       ├── loyalty                Object → points
│       └── isDeleted, createdAt, updatedAt
│
├── 📁 12_integrations/                                       1 collection · 12 fields
│   │
│   └── 📄 platform_integrations 🔒        🟢 ~restaurants × 3 platforms · 12 fields
│       ├── _id, restaurantId, platform, externalRestaurantId
│       ├── credentials 🔒          Object → accessTokenEnc, refreshTokenEnc, expiresAt
│       ├── syncSettings           Object → menuSync, orderSync, autoAcceptOrders
│       └── status, lastSyncedAt, isDeleted, createdAt, updatedAt, version
│
├── 📁 13_compliance/                                         1 collection · 10 fields
│   │
│   └── 📄 audit_logs                     🔴 ~millions (immutable, long retention) · 10 fields
│       ├── _id, restaurantId, actorId, actorType, action
│       ├── entity                 Object → collection, id
│       ├── before, after          Object (redacted snapshots)
│       └── ip, at
│
└── 📁 14_media/                                              1 collection · 8 fields
    │
    └── 📄 media_assets                   🔴 ~500K–10M docs (metadata only, binaries in S3) · 8 fields
        └── _id, restaurantId, ownerType, ownerId, url, type, sizeBytes, createdAt
```

---

## 2. Step-by-Step Optimized Build Order

Collections are **not created randomly** — the order below creates independent/parent collections first, so every collection that follows can safely reference IDs that already exist, and indexes are attached the moment each collection is created (never bolted on after the app is already writing to it).

| # | Collection | Depends on | Create with these indexes immediately |
|---|---|---|---|
| 1 | `users` | — (global, independent) | `{email:1}` unique sparse, `{mobile:1}` unique sparse |
| 2 | `restaurants` | `users` (owner ref) | `{slug:1}` unique, `{"location.geo":"2dsphere"}`, `{chainId:1}`, `{"onboarding.stage":1}` |
| 3 | `restaurant_staff` | `restaurants`, `users` | `{restaurantId:1, userId:1}` unique, `{userId:1}`, `{restaurantId:1, role:1}` |
| 4 | `screens` | `restaurants` | `{restaurantId:1, username:1}` unique |
| 5 | `platform_integrations` | `restaurants` | `{restaurantId:1, platform:1}` unique |
| 6 | `menu_categories` | `restaurants` | `{restaurantId:1, sortOrder:1}` |
| 7 | `menu_items` | `menu_categories` | `{restaurantId:1, categoryId:1, isDeleted:1}`, `{restaurantId:1, "stock.inStock":1}`, text index on `name,tags`, `{"platformMappings.platform":1,"platformMappings.externalItemId":1}` |
| 8 | `tables` | `restaurants` | `{restaurantId:1, tableNumber:1}` unique, `{qrCodeToken:1}` unique |
| 9 | `customers` | — (global, independent) | `{mobile:1}` unique sparse |
| 10 | `table_sessions` | `tables` | `{tableId:1, status:1}`, `{expiresAt:1}` **TTL**, `{"scannedDevice.fingerprint":1}` |
| 11 | `orders` | `restaurants`, `menu_items`, `table_sessions`, `customers` | `{restaurantId:1, status:1, placedAt:-1}`, `{restaurantId:1, placedAt:-1}`, `{"source.platform":1,"source.externalOrderId":1}` unique partial, `{restaurantId:1, orderNumber:1}` unique |
| 12 | `service_requests` | `tables`, `table_sessions` | `{restaurantId:1, status:1, raisedAt:-1}` |
| 13 | `inventory_items` | `restaurants` | `{restaurantId:1, currentStock:1, reorderThreshold:1}` |
| 14 | `inventory_transactions` | `inventory_items`, `orders` | `{restaurantId:1, inventoryItemId:1, recordedAt:-1}` |
| 15 | `finance_transactions` | `restaurants`, `orders` | `{restaurantId:1, transactionDate:-1}`, `{restaurantId:1, type:1, transactionDate:-1}` |
| 16 | `daily_reports` | `orders`, `finance_transactions` (computed by scheduled job) | `{restaurantId:1, date:-1}` unique |
| 17 | `bookings` | `restaurants`, `tables` | `{restaurantId:1, bookingDate:1, status:1}`, `{"source.platform":1,"source.externalBookingId":1}` unique partial |
| 18 | `campaigns` | `restaurants` | `{restaurantId:1, status:1}`, `{"schedule.startAt":1,"schedule.endAt":1}` |
| 19 | `ratings_reviews` | `orders`, `customers` | `{restaurantId:1, createdAt:-1}`, `{"itemRatings.menuItemId":1}` |
| 20 | `complaints` | `orders`, `customers` | `{restaurantId:1, status:1, createdAt:-1}` |
| 21 | `notifications` | `restaurants`, `screens` | `{restaurantId:1, createdAt:-1}`, `{expiresAt:1}` **TTL** |
| 22 | `media_assets` | `restaurants`, `menu_items` (or any owner) | `{restaurantId:1, ownerType:1, ownerId:1}` |
| 23 | `audit_logs` | everything (polymorphic, logs any collection) | `{restaurantId:1, at:-1}`, `{"entity.collection":1,"entity.id":1, at:-1}` |

**Why this order is "optimized," not arbitrary:**
- Steps 1–9 are pure master data with no cross-collection reads yet — safe to bulk-load or seed first.
- `orders` (step 11) is deliberately placed *after* everything it snapshots (`menu_items`, `tables`/`sessions`, `customers`) so line-item price/name snapshots and `source.tableSessionId` always resolve.
- Ledger collections (`inventory_transactions`, `finance_transactions`, step 14–15) come right after the things they debit/credit (`inventory_items`, `orders`), keeping referential creation logical even without enforced FKs.
- `daily_reports` (step 16) is last among the analytics group because it's a **derived/computed** collection — it should never be seeded manually, only populated by a nightly job once `orders`/`finance_transactions` exist.
- `audit_logs` is created last conceptually (though the collection itself can technically be created any time) because it's polymorphic and references *every other* collection's documents.

---

## 3. One Build Command Per Step (representative pattern)

The same `createCollection` + `createIndex` pattern is repeated for all 23 — here it is for the first three steps, to copy-paste and extend down the table above:

```js
// Step 1 — users
db.createCollection("users", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["fullName", "status"],
    properties: {
      fullName: { bsonType: "string" },
      email:    { bsonType: ["string", "null"] },
      mobile:   { bsonType: ["string", "null"] },
      status:   { enum: ["active", "suspended"] }
    }
  }}
});
db.users.createIndex({ email: 1 }, { unique: true, sparse: true });
db.users.createIndex({ mobile: 1 }, { unique: true, sparse: true });

// Step 2 — restaurants
db.createCollection("restaurants", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["name", "slug", "owner"],
    properties: {
      name: { bsonType: "string" },
      slug: { bsonType: "string" }
    }
  }}
});
db.restaurants.createIndex({ slug: 1 }, { unique: true });
db.restaurants.createIndex({ "location.geo": "2dsphere" });
db.restaurants.createIndex({ chainId: 1 });

// Step 3 — restaurant_staff
db.createCollection("restaurant_staff");
db.restaurant_staff.createIndex({ restaurantId: 1, userId: 1 }, { unique: true });
db.restaurant_staff.createIndex({ userId: 1 });
```

Continue this same pattern for steps 4–23 using the index columns in the table above — each `createCollection` call should include a `$jsonSchema` validator listing only the fields that are truly required at write time (per Phase 9/14 of the main design doc), so the schema can evolve without breaking writes.
