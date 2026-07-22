# Section 3.4: Table & QR Ordering API Reference

[← Staff & Screens API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/03-staff-and-screens-api.md) | [Next: Menu Catalog API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/05-menu-catalog-api.md)

---

## 1. Process Customer QR Scan
- **Method**: `GET`
- **Path**: `/api/v1/tables/scan/:code`
- **Auth Required**: Public (Customer device)
- **Query Params**: `?customerName=John&numberOfPeople=2&deviceId=dev_xyz`
- **Response (`200 OK`)**: Validates `qrCode.isActive`, checks device lock, and returns active menu catalog.

---

## 2. Trigger Customer Service Request
- **Method**: `POST`
- **Path**: `/api/v1/tables/:id/service`
- **Auth Required**: Public (Customer active session)
- **Request Body**: `{ "serviceType": "water", "note": "Cold water please" }`

---

## 3. Create Floor Table
- **Method**: `POST`
- **Path**: `/api/v1/tables`
- **Auth Required**: Protected (`owner`, `manager`)
- **Request Body**: `{ "tableNumber": "T-04", "capacity": 4, "section": "Main Hall" }`

---

## 4. Toggle Table QR Scanning Permission
- **Method**: `PATCH`
- **Path**: `/api/v1/tables/:id/qr-toggle`
- **Auth Required**: Protected (`owner`, `manager`, `server`)
- **Request Body**: `{ "isActive": true }`

---

## 5. Table Checkout
- **Method**: `POST`
- **Path**: `/api/v1/tables/:id/checkout`
- **Auth Required**: Protected (`owner`, `manager`, `server`)
- **Description**: Clears session, resets table status to `vacant`, and sets `qrCode.isActive = false`.

---

[← Staff & Screens API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/03-staff-and-screens-api.md) | [Next: Menu Catalog API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/05-menu-catalog-api.md)
