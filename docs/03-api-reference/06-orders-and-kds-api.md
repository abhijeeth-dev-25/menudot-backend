# Section 3.6: Orders & Kitchen Display System (KDS) API Reference

[← Menu Catalog API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/05-menu-catalog-api.md) | [Next: Aggregators & Webhooks API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/07-aggregator-and-webhooks-api.md)

---

## 1. Place Dine-in QR Order
- **Method**: `POST`
- **Path**: `/api/v1/orders`
- **Auth Required**: Public (Active Customer Session) or Staff
- **Request Body**:
  ```json
  {
    "restaurantId": "65b...",
    "tableId": "65b...",
    "items": [
      { "itemId": "65b...", "quantity": 2, "selectedAddons": [], "specialNotes": "Less spicy" }
    ],
    "paymentMethod": "cash"
  }
  ```

---

## 2. List Active KDS Orders
- **Method**: `GET`
- **Path**: `/api/v1/orders`
- **Auth Required**: Protected (`owner`, `manager`, `chef`, `server`)
- **Query Params**: `?status=preparing&platform=dine_in`

---

## 3. Update Order Status (KDS State Machine)
- **Method**: `PATCH`
- **Path**: `/api/v1/orders/:id/status`
- **Auth Required**: Protected (`owner`, `manager`, `chef`, `server`)
- **Request Body**: `{ "status": "preparing" }` (Valid states: `received`, `preparing`, `ready`, `served`, `completed`, `cancelled`)

---

[← Menu Catalog API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/05-menu-catalog-api.md) | [Next: Aggregators & Webhooks API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/07-aggregator-and-webhooks-api.md)
