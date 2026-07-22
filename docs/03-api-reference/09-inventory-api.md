# Section 3.9: Inventory & Raw Materials API Reference

[← Dineout Bookings API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/08-bookings-dineout-api.md) | [Next: Finance & P&L API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/10-finance-and-pl-api.md)

---

## 1. List Stock Items
- **Method**: `GET`
- **Path**: `/api/v1/inventory`
- **Auth Required**: Protected (`owner`, `manager`, `chef`)

---

## 2. Add Raw Material
- **Method**: `POST`
- **Path**: `/api/v1/inventory`
- **Auth Required**: Protected (`owner`, `manager`)
- **Request Body**: `{ "name": "Refined Flour", "unit": "kg", "currentStock": 100, "reorderThreshold": 20 }`

---

## 3. Log Stock Movement
- **Method**: `POST`
- **Path**: `/api/v1/inventory/:id/stock`
- **Auth Required**: Protected (`owner`, `manager`, `chef`)
- **Request Body**: `{ "quantity": 25, "transactionType": "in", "reason": "Restock supplier delivery" }`

---

[← Dineout Bookings API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/08-bookings-dineout-api.md) | [Next: Finance & P&L API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/10-finance-and-pl-api.md)
