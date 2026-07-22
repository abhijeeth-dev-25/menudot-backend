# Section 2.2: Restaurant Setup & Provisioning Workflow

[← Onboarding & Verification](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/01-onboarding-and-verification.md) | [Next: Table QR & Session Lock →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/03-table-qr-session-management.md)

---

## 1. Process Overview

Once approved, the restaurant owner initializes operational settings, creates menu items, sets up staff login credentials, and provisions physical hardware tablets.

---

## 2. Step-by-Step Execution Flow

### Step 1: Owner Authentication
- **API**: `POST /api/v1/auth/login`
- **Payload**: `{ "email": "owner@gourmetbistro.com", "password": "SecurePassword123!" }`
- **System Action**: Validates bcrypt password hash and returns JWT Access & Refresh tokens.

### Step 2: Menu Catalog Setup
1. **Create Menu Categories**:
   - **API**: `POST /api/v1/menu/categories`
   - **Header**: `x-restaurant-id: <restaurantId>`
   - **Payload**: `{ "name": "Starters", "displayOrder": 1 }`
2. **Add Menu Items**:
   - **API**: `POST /api/v1/menu/items`
   - **Header**: `x-restaurant-id: <restaurantId>`
   - **Payload**:
     ```json
     {
       "categoryId": "65b...",
       "name": "Paneer Tikka",
       "price": 320,
       "isVeg": true,
       "description": "Char-grilled cottage cheese cubes",
       "ingredients": ["Paneer", "Yogurt", "Spices"],
       "isAvailable": true
     }
     ```
   - **Image Upload**: Item photos are uploaded to ImageKit CDN via multipart form uploads.

### Step 3: Staff Account Provisioning
- **API**: `POST /api/v1/staff`
- **Header**: `x-restaurant-id: <restaurantId>`
- **Roles Created**:
  - `manager`: Full operational management.
  - `chef`: Kitchen Display System & menu stock toggling.
  - `server`: Floor waiter layout, table QR permissions, service requests.

### Step 4: KDS Hardware & Cashier Screen Provisioning
- **API**: `POST /api/v1/screens`
- **Header**: `x-restaurant-id: <restaurantId>`
- **Payload**: `{ "name": "Kitchen Display Tablet 1", "allowedServices": ["order_status"], "allowedTables": [] }`
- **System Action**: Generates a long-lived device token for mounting physical Android/iOS kitchen tablets.

---

[← Onboarding & Verification](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/01-onboarding-and-verification.md) | [Next: Table QR & Session Lock →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/03-table-qr-session-management.md)
