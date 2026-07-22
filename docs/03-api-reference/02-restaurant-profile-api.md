# Section 3.2: Restaurant Profile API Reference

[← Authentication API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/01-authentication-api.md) | [Next: Staff & Screens API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/03-staff-and-screens-api.md)

---

## 1. Get Restaurant Profile
Fetch profile details for active tenant.

- **Method**: `GET`
- **Path**: `/api/v1/restaurants/profile`
- **Auth Required**: Protected (`owner`, `manager`)
- **Header**: `x-restaurant-id: <restaurantId>`
- **Response (`200 OK`)**: Decrypts legal & bank fields if requested by `owner`.

---

## 2. Update Restaurant Profile
Update operating hours, cost for two, and packing charges.

- **Method**: `PUT`
- **Path**: `/api/v1/restaurants/profile`
- **Auth Required**: Protected (`owner`)
- **Header**: `x-restaurant-id: <restaurantId>`
- **Request Body**:
  ```json
  {
    "openingTime": "09:00",
    "closingTime": "23:30",
    "costForTwo": 1500,
    "packingCharges": 60
  }
  ```

---

[← Authentication API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/01-authentication-api.md) | [Next: Staff & Screens API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/03-staff-and-screens-api.md)
