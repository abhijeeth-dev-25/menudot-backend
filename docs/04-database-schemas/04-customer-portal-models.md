# Section 4.4: Customer Portal & Experience Data Models

[← Operations, Finance & Ads Schemas](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/03-inventory-finance-ads.md) | [Next: Deployment & Ops →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/05-deployment-and-ops/01-environment-and-setup.md)

---

## 1. `ExperienceService` Model (`experienceService.model.js`)

Represents special experience offerings and amenities provided by the restaurant.

### Schema Fields
- `restaurantId`: ObjectId (Ref: `Restaurant`, Required, Auditable)
- `title`: String (Required, e.g. `"Buffet Dining"`, `"Rooftop Bar & Lounge"`)
- `category`: Enum (`'dining'`, `'nightlife_bar'`, `'buffet'`, `'rooms_stay'`, `'events_music'`, `'amenities'`, `'other'`)
- `tagline`: String (e.g. `"Unlimited 45+ dishes spread"`)
- `description`: String
- `imageUrl`: String (CDN image link)
- `iconName`: String (Lucide icon identifier, e.g. `"Utensils"`, `"Beer"`, `"Bed"`)
- `highlights`: Array of Strings (e.g. `["Live DJ", "AC Hall", "Alcohol Served"]`)
- `timing`: String (e.g. `"12:00 PM - 3:30 PM"`)
- `priceStartingFrom`: Number (Optional starting price)
- `isAvailable`: Boolean (Default: `true`)
- `sortOrder`: Number (Default: `0`)

---

## 2. `HeroBanner` Model (`heroBanner.model.js`)

Represents dynamic promotional hero banners displayed on the customer home page carousel.

### Schema Fields
- `restaurantId`: ObjectId (Ref: `Restaurant`, Required, Auditable)
- `title`: String (Required)
- `subtitle`: String
- `badgeText`: String (e.g. `"20% OFF"`, `"WEEKEND SPECIAL"`)
- `imageUrl`: String (Required)
- `ctaType`: Enum (`'category'`, `'menu_item'`, `'coupon'`, `'service'`, `'external_link'`, `'none'`)
- `ctaTargetId`: String
- `ctaLabel`: String (Default: `"Explore Now"`)
- `isActive`: Boolean (Default: `true`)
- `startDate`: Date
- `endDate`: Date
- `sortOrder`: Number

---

## 3. `SwiggyLink` Model (`swiggyLink.model.js`)

Represents optional customer Swiggy partner account linking for co-branded discounts.

### Schema Fields
- `restaurantId`: ObjectId (Ref: `Restaurant`, Required)
- `deviceId`: String (Required, Index)
- `swiggyUserId`: String (Required)
- `swiggyMobile`: String
- `isLinked`: Boolean (Default: `true`)
- `partnerOffers`: Array of `{ offerId, title, discountPercent, maxDiscount }`
- `linkedAt`: Date (Default: `Date.now`)

---

## 4. Multi-Outlet `branches` Array (`Restaurant` Model Extension)

Embedded in `restaurant.model.js` to store chain branch details.

### Schema Fields
- `branches`: Array of:
  - `name`: String (Required)
  - `address`: String (Required)
  - `city`: String (Required)
  - `mobile`: String (Required)
  - `googleMapsUrl`: String
  - `isMainBranch`: Boolean (Default: `false`)
  - `isOpen`: Boolean (Default: `true`)
  - `timings`: String (Default: `"10:00 AM - 11:00 PM"`)
