# Section 4.1: Core & User Data Models

[← Platform Admin API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/12-platform-admin-api.md) | [Next: Menu & Orders Schemas →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/02-menu-and-orders.md)

---

## 1. `Restaurant` Model (`restaurant.model.js`)

Represents a merchant restaurant tenant application and profile.

### Schema Fields
- `ownerName`: String (Required)
- `restaurantName`: String (Required)
- `location`: `{ address, city, state, pincode }`
- `email`: String (Required, Unique index)
- `mobileNumber`: String (Required)
- `whatsAppNumber`: String
- `workingDays`: Array of Strings
- `openingTime`: String (`"10:00"`)
- `closingTime`: String (`"23:00"`)
- `outletType`: String
- `ownerPan`: String (AES-256-GCM Encrypted)
- `gstin`: String (AES-256-GCM Encrypted)
- `bankDetails`: `{ accountNumber, ifscCode }` (AES-256-GCM Encrypted)
- `fssaiNumber`: String (AES-256-GCM Encrypted)
- `foodType`: Enum (`'Veg'`, `'Non-Veg'`, `'Both'`)
- `cuisines`: Array of Strings
- `costForTwo`: Number
- `packingCharges`: Number
- `status`: Enum (`'pending'`, `'approved'`, `'rejected'`, `'suspended'`)

---

## 2. `User` Model (`user.model.js`)

Represents staff members and platform administration staff.

### Schema Fields
- `name`: String (Required)
- `email`: String (Required, Unique index)
- `password`: String (Bcrypt Hashed)
- `role`: Enum (`'owner'`, `'manager'`, `'chef'`, `'server'`, `'super_admin'`, `'platform_admin'`, `'verification'`, `'finance'`, `'operations'`, `'support'`, `'safety'`, `'sales'`, `'tech'`, `'audit'`)
- `permissions`: Array of Strings
- `restaurantId`: ObjectId (Ref: `Restaurant`)

---

## 3. `Table` Model (`table.model.js`)

Represents physical floor tables and QR session security token state.

### Schema Fields
- `restaurantId`: ObjectId (Required)
- `tableNumber`: String (Required, unique per restaurant)
- `capacity`: Number
- `section`: String (`"Main Hall"`, `"Outdoor Terrace"`)
- `status`: Enum (`'vacant'`, `'occupied'`, `'reserved'`)
- `qrCode`: `{ code: String, isActive: Boolean }`
- `activeSession`: `{ customerName, numberOfPeople, deviceId, deviceDetails, scannedAt, orderIds }`

---

## 4. `Screen` Model (`screen.model.js`)

Represents hardware tablet screen display configurations.

### Schema Fields
- `restaurantId`: ObjectId (Required)
- `name`: String (`"Kitchen Display 1"`)
- `token`: String (Unique)
- `allowedServices`: Array of Strings
- `allowedTables`: Array of ObjectIds

---

[← Platform Admin API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/12-platform-admin-api.md) | [Next: Menu & Orders Schemas →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/02-menu-and-orders.md)
