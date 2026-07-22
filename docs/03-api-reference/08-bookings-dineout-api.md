# Section 3.8: Dineout Bookings API Reference

[← Aggregators & Webhooks API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/07-aggregator-and-webhooks-api.md) | [Next: Inventory API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/09-inventory-api.md)

---

## 1. Create Public Table Pre-Booking
- **Method**: `POST`
- **Path**: `/api/v1/bookings/public`
- **Auth Required**: Public
- **Request Body**:
  ```json
  {
    "restaurantId": "65b...",
    "customerName": "Alice",
    "phone": "+919812345678",
    "bookingDate": "2026-07-25",
    "bookingTime": "20:00",
    "guestCount": 4
  }
  ```

---

## 2. Manage Bookings
- **Method**: `PATCH`
- **Path**: `/api/v1/bookings/:id/status`
- **Auth Required**: Protected (`owner`, `manager`, `server`)
- **Request Body**: `{ "status": "seated" }` (`confirmed`, `seated`, `cancelled`, `no_show`)

---

[← Aggregators & Webhooks API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/07-aggregator-and-webhooks-api.md) | [Next: Inventory API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/09-inventory-api.md)
