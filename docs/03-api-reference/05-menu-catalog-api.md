# Section 3.5: Menu Catalog API Reference

[← Table & QR API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/04-table-and-qr-api.md) | [Next: Orders & KDS API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/06-orders-and-kds-api.md)

---

## 1. Create Menu Category
- **Method**: `POST`
- **Path**: `/api/v1/menu/categories`
- **Auth Required**: Protected (`owner`, `manager`)
- **Request Body**: `{ "name": "Desserts", "displayOrder": 3 }`

---

## 2. Create Menu Item
- **Method**: `POST`
- **Path**: `/api/v1/menu/items`
- **Auth Required**: Protected (`owner`, `manager`, `chef`)
- **Request Body**:
  ```json
  {
    "categoryId": "65b...",
    "name": "Gulab Jamun",
    "price": 140,
    "isVeg": true,
    "description": "Warm milk solids in sugar syrup",
    "ingredients": ["Milk solids", "Sugar", "Cardamom"],
    "isAvailable": true
  }
  ```

---

## 3. Quick Item Availability Toggle
- **Method**: `PATCH`
- **Path**: `/api/v1/menu/items/:id/stock`
- **Auth Required**: Protected (`owner`, `manager`, `chef`)
- **Request Body**: `{ "isAvailable": false }`

---

[← Table & QR API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/04-table-and-qr-api.md) | [Next: Orders & KDS API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/06-orders-and-kds-api.md)
