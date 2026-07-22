# Section 3.7: Aggregators & Webhooks API Reference

[← Orders & KDS API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/06-orders-and-kds-api.md) | [Next: Dineout Bookings API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/08-bookings-dineout-api.md)

---

## 1. Configure Aggregator Integration Credentials
- **Method**: `POST`
- **Path**: `/api/v1/integrations`
- **Auth Required**: Protected (`owner`)
- **Header**: `x-restaurant-id: <restaurantId>`
- **Request Body**:
  ```json
  {
    "platform": "swiggy",
    "merchantId": "SW-99823",
    "apiKey": "key_live_xxx",
    "isEnabled": true
  }
  ```

---

## 2. Aggregator Live Order Webhooks
- **Method**: `POST`
- **Paths**:
  - `/api/v1/webhooks/swiggy`
  - `/api/v1/webhooks/zomato`
  - `/api/v1/webhooks/magicpin`
- **Auth Required**: HMAC Signature (`x-swiggy-signature`, `x-zomato-signature`, etc.)
- **Description**: Normalizes external payload, saves order into database, and broadcasts `order_created` to KDS over WebSocket.

---

[← Orders & KDS API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/06-orders-and-kds-api.md) | [Next: Dineout Bookings API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/08-bookings-dineout-api.md)
