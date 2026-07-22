# Section 4.2: Catalog & Order Data Models

[← Core & User Schemas](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/01-core-and-users.md) | [Next: Inventory & Finance Schemas →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/03-inventory-finance-ads.md)

---

## 1. `MenuItem` Model (`menuItem.model.js`)

- `restaurantId`: ObjectId
- `categoryId`: ObjectId (Ref: `MenuCategory`)
- `name`: String
- `price`: Number
- `isVeg`: Boolean
- `description`: String
- `ingredients`: Array of Strings
- `imageUrl`: String (ImageKit CDN)
- `addons`: Array of `{ name, price }`
- `isAvailable`: Boolean

---

## 2. `Order` Model (`order.model.js`)

- `orderNumber`: String (Auto-generated)
- `restaurantId`: ObjectId
- `tableId`: ObjectId (Ref: `Table`)
- `platform`: Enum (`'dine_in'`, `'swiggy'`, `'zomato'`, `'magicpin'`)
- `items`: Array of `{ itemId, name, price, quantity, selectedAddons, specialNotes }`
- `status`: Enum (`'received'`, `'preparing'`, `'ready'`, `'served'`, `'completed'`, `'cancelled'`)
- `paymentMethod`: Enum (`'cash'`, `'upi'`, `'card'`, `'online'`)
- `subtotal`: Number
- `tax`: Number
- `packingCharges`: Number
- `platformCharge`: Number
- `discount`: Number
- `total`: Number

---

## 3. `Booking` Model (`booking.model.js`)

- `restaurantId`: ObjectId
- `customerName`: String
- `phone`: String
- `bookingDate`: Date
- `bookingTime`: String
- `guestCount`: Number
- `status`: Enum (`'confirmed'`, `'seated'`, `'cancelled'`, `'no_show'`)

---

[← Core & User Schemas](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/01-core-and-users.md) | [Next: Inventory & Finance Schemas →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/03-inventory-finance-ads.md)
