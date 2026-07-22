# Section 3.4: Table & QR Ordering API Reference

[← Staff & Screens API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/03-staff-and-screens-api.md) | [Next: Menu Catalog API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/05-menu-catalog-api.md)

---

## Endpoint Summary

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/tables/scan` | None (Public) | Customer scans table QR code (returns menu catalog or `activation_pending` error) |
| `POST` | `/api/v1/tables/:id/unlock-access` | Bearer Token (Staff) | Staff approves walk-in QR ordering access, setting `qrCode.isActive = true` |
| `GET` | `/api/v1/tables/staff/pending-unlock-requests` | Bearer Token (Staff) | Lists all tables with pending walk-in activation requests |
| `PATCH` | `/api/v1/tables/:id/qr/toggle` | Bearer Token (Staff) | Manually toggles table QR code scanning permission |
| `POST` | `/api/v1/tables/:id/checkout` | Bearer Token (Staff) | Clears session, auto-applies pre-paid booking fee credit, resets status to `vacant` |

---

## Detailed Endpoint Contracts

### 1. Process Customer QR Scan
`POST /api/v1/tables/scan`

Scans table QR code token. If `qrCode.isActive === true`, initializes device session and returns full menu catalog. If `qrCode.isActive === false`, registers a pending staff unlock request, dispatches real-time WebSocket alert `staff:qr_unlock_request`, and returns HTTP 403 `activation_pending`.

#### Request Body
```json
{
  "code": "3f8a0b1c2d3e4f5a6b7c8d9e0f1a2b3c",
  "customerName": "Hannah Abbott",
  "numberOfPeople": 3,
  "deviceId": "device_hannah_456"
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Welcome to Menudot! Table session initialized.",
  "data": {
    "table": {
      "id": "60d5ecb8b3b72c001f3e9c10",
      "tableNumber": "T-02",
      "status": "occupied"
    },
    "restaurant": { "name": "Test Bistro" },
    "menu": []
  }
}
```

#### Pending Activation Response (`403 Forbidden`)
```json
{
  "success": false,
  "message": "Table \"T-02\" ordering is currently locked. Restaurant staff has been notified to activate your table.",
  "errors": {
    "status": "activation_pending",
    "tableId": "60d5ecb8b3b72c001f3e9c10",
    "tableNumber": "T-02",
    "requestedAt": "2026-07-22T17:26:00.000Z"
  }
}
```

---

### 2. Staff Unlock Table Access
`POST /api/v1/tables/:id/unlock-access`

Staff approves a walk-in guest's QR activation request. Sets `qrCode.isActive = true`, `status = 'occupied'`, clears `qrUnlockRequest`, and emits `table:qr_unlocked` over WebSockets to automatically refresh the customer's phone UI.

#### Request Body
```json
{
  "customerName": "Hannah Abbott",
  "numberOfPeople": 3,
  "deviceId": "device_hannah_456"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Table QR ordering access unlocked successfully",
  "data": {
    "id": "60d5ecb8b3b72c001f3e9c10",
    "tableNumber": "T-02",
    "status": "occupied",
    "qrCode": { "isActive": true }
  }
}
```

---

### 3. Get Pending Unlock Requests
`GET /api/v1/tables/staff/pending-unlock-requests`

Lists all tables where walk-in guests have scanned inactive QR codes and are awaiting staff unlock approval.

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Pending table unlock requests retrieved",
  "data": [
    {
      "_id": "60d5ecb8b3b72c001f3e9c10",
      "tableNumber": "T-02",
      "qrUnlockRequest": {
        "requested": true,
        "customerName": "Hannah Abbott",
        "numberOfPeople": 3,
        "requestedAt": "2026-07-22T17:26:00.000Z"
      }
    }
  ]
}
```

---

[← Staff & Screens API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/03-staff-and-screens-api.md) | [Next: Menu Catalog API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/05-menu-catalog-api.md)
