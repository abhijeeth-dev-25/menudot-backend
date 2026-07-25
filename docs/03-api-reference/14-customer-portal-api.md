# Section 3.14: Customer Portal & Ad Engine API

[← Back to Index](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/README.md)

---

## 1. Overview

The **Customer Portal API** powers the multi-tab web application accessed by restaurant dining guests (**Home**, **Menu**, **Service**, **Account**, **Live Order Status Tracking**, and **Targeted Ads**).

It supports pre-unlock read-only browsing (viewing banners, experiences, catalog, search, and outlets) before table activation, and unlocks active ordering controls once table QR access is approved by restaurant staff.

---

## 2. API Endpoints Reference

### A. Home Page & Experiences (`/api/v1/customer/*`)

#### 1. `GET /api/v1/customer/home-feed`
Compiles complete aggregated Home Page payload in a single HTTP request.

- **Headers**: `x-restaurant-id: <restaurantObjectId>` (Required), `x-device-id: <deviceId>` (Optional)
- **Query Params**: `tableCode=<code >` (Optional)
- **Response**:
  ```json
  {
    "success": true,
    "message": "Customer home feed retrieved successfully",
    "data": {
      "restaurant": {
        "id": "6a64...",
        "name": "Spice Garden Bistro",
        "ratingsSummary": { "overallRating": 4.9, "totalReviews": 120 },
        "branches": [...]
      },
      "sessionStatus": {
        "isUnlocked": true,
        "sessionState": "occupied",
        "tableNumber": "T-04"
      },
      "heroBanners": [...],
      "offers": [...],
      "experienceServices": [...],
      "featuredCategories": [...]
    }
  }
  ```

#### 2. `GET /api/v1/customer/experience-services`
Returns experience offerings provided by the restaurant (*Buffet, Cocktail Bar, Rooms/Stay, Live Music, Private Dining*).

#### 3. `GET /api/v1/customer/branches`
Returns list of multi-outlet branches for the restaurant chain.

---

### B. Menu Catalog & Search Engine

#### 1. `GET /api/v1/customer/menu`
Retrieves full menu catalog grouped by active menu categories.

#### 2. `GET /api/v1/customer/menu/search`
Multi-filter instant menu search endpoint.

- **Query Parameters**:
  - `q` / `search`: Text query string (e.g. `Paneer`, `Biryani`).
  - `foodType`: `veg` | `non-veg` | `both`.
  - `categoryId`: Filter by category ObjectId.
  - `inStockOnly`: `true` | `false`.
  - `sortBy`: `relevance` | `price_asc` | `price_desc` | `rating`.

#### 3. `GET /api/v1/customer/menu/items/:itemId`
Retrieves item detail payload with variant choices, add-on groups, and ingredient tags.

---

### C. Account, Swiggy Link & Bills

#### 1. `POST /api/v1/customer/swiggy/link`
Links optional Swiggy partner account to unlock co-branded discounts.

- **Body**:
  ```json
  {
    "deviceId": "device_123",
    "swiggyUserId": "swiggy_user_99",
    "swiggyMobile": "+919876543210"
  }
  ```

#### 2. `GET /api/v1/customer/swiggy/status`
Checks if the customer device has active Swiggy partner linking.

#### 3. `GET /api/v1/customer/orders/history`
Returns chronological order history for the customer's device.

#### 4. `GET /api/v1/customer/bill`
Calculates active table order breakdown, subtotal, GST tax, packing charges, discounts, and total net payable.

---

### D. Live Order Status & Table Service Calls

#### 1. `GET /api/v1/customer/status`
Returns real-time order lifecycle tracking progress steps (`received` → `preparing` → `ready` → `served` → `completed`).

#### 2. `POST /api/v1/customer/service-request`
Alerts staff POS/KDS terminals via Socket.io (`water`, `bill`, `waiter`, `cleaning`). Required: active unlocked table session.

---

### E. Ad Serving Engine

#### `GET /api/v1/customer/ads`
Serves targeted ad creatives across 5 UI placement zones:
- `home_top_banner` (Hero Carousel)
- `home_in_feed` (Mid-feed cards)
- `navbar_bottom_sticky` (Sticky footer ad banner)
- `payment_checkout_banner` (Checkout & payment modal ads)
- `order_status_card` (Contextual ad card while waiting for food)

---

### F. Merchant Experience Management (`/api/v1/restaurant/experiences/*`)

- `POST /api/v1/restaurant/experiences/experience-services` (Create Experience Service)
- `GET /api/v1/restaurant/experiences/experience-services` (List Experience Services)
- `PATCH /api/v1/restaurant/experiences/experience-services/:id` (Update Experience Service)
- `DELETE /api/v1/restaurant/experiences/experience-services/:id` (Soft Delete Experience Service)
- `POST /api/v1/restaurant/experiences/hero-banners` (Create Hero Banner)
- `GET /api/v1/restaurant/experiences/hero-banners` (List Hero Banners)
- `PATCH /api/v1/restaurant/experiences/hero-banners/:id` (Update Hero Banner)
- `DELETE /api/v1/restaurant/experiences/hero-banners/:id` (Soft Delete Hero Banner)
- `PUT /api/v1/restaurant/experiences/branches` (Update Multi-Outlet Branches)
