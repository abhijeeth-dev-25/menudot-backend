# Section 3.3: Staff & Screen Management API Reference

[← Restaurant Profile API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/02-restaurant-profile-api.md) | [Next: Table & QR API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/04-table-and-qr-api.md)

---

## 1. List Staff Members
- **Method**: `GET`
- **Path**: `/api/v1/staff`
- **Auth Required**: Protected (`owner`, `manager`)
- **Header**: `x-restaurant-id: <restaurantId>`

---

## 2. Create Staff Account
- **Method**: `POST`
- **Path**: `/api/v1/staff`
- **Auth Required**: Protected (`owner`, `manager`)
- **Header**: `x-restaurant-id: <restaurantId>`
- **Request Body**:
  ```json
  {
    "name": "Alex Chef",
    "email": "alex@bistro.com",
    "password": "Password123!",
    "role": "chef"
  }
  ```

---

## 3. Provision Tablet Hardware Screen
- **Method**: `POST`
- **Path**: `/api/v1/screens`
- **Auth Required**: Protected (`owner`, `manager`)
- **Header**: `x-restaurant-id: <restaurantId>`
- **Request Body**:
  ```json
  {
    "name": "Kitchen Display Tablet 1",
    "allowedServices": ["order_status"],
    "allowedTables": []
  }
  ```

---

[← Restaurant Profile API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/02-restaurant-profile-api.md) | [Next: Table & QR API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/04-table-and-qr-api.md)
