# Section 3.8: Bookings, Verification Coupons & Walk-In API Reference

[← Orders API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/07-orders-api.md) | [Next: Inventory API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/09-inventory-api.md)

---

## Endpoint Summary

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/bookings/public/create` | None (Public) | Anonymous web slot booking (calculates ₹20/guest pre-booking fee & payment order) |
| `POST` | `/api/v1/bookings/public/verify-payment` | None (Public) | Verifies payment, generates 6-char Coupon Code, sends confirmation email |
| `POST` | `/api/v1/bookings/verify-coupon` | Bearer Token (Staff) | Staff verifies coupon code, seats customer, assigns table, activates QR scanning |
| `GET` | `/api/v1/bookings/tables/available-for-walkin` | Bearer Token (Staff) | Returns vacant tables for walk-in guests excluding pre-booked slots in buffer window |
| `GET` | `/api/v1/bookings` | Bearer Token (Staff) | Lists all bookings for restaurant dashboard |
| `GET` | `/api/v1/bookings/staff/history` | Bearer Token (Staff) | Alias for retrieving full booking history |
| `PATCH` | `/api/v1/bookings/:id` | Bearer Token (Staff) | Updates booking status or assigned table |
| `POST` | `/api/v1/bookings/webhooks/dineout/:platform` | None (Public / Webhook) | Ingests external Dineout reservations from Swiggy/Zomato |

---

## Detailed Endpoint Contracts

### 1. Create Anonymous Web Slot Booking
`POST /api/v1/bookings/public/create`

Calculates a pre-booking fee of ₹20 per guest, creates a pending booking record, and returns a payment order structure from the Payment Gateway abstraction layer.

#### Request Body
```json
{
  "restaurantId": "60d5ecb8b3b72c001f3e9c10",
  "customerName": "Alice Johnson",
  "customerEmail": "alice@example.com",
  "customerMobile": "+919876543210",
  "numberOfPeople": 4,
  "bookingDate": "2026-07-25",
  "timeSlot": "20:00"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Anonymous slot booking created (pending payment)",
  "data": {
    "booking": {
      "id": "60d5ecb8b3b72c001f3e9c22",
      "customerName": "Alice Johnson",
      "customerEmail": "alice@example.com",
      "prebookingFee": 80,
      "status": "pending_payment"
    },
    "payment": {
      "paymentId": "pay_mock_a1b2c3d4",
      "amount": 80,
      "currency": "INR",
      "status": "PENDING"
    }
  }
}
```

---

### 2. Verify Booking Payment & Send Email
`POST /api/v1/bookings/public/verify-payment`

Verifies payment with `PaymentService`, generates a unique 6-character Verification Coupon Code (e.g. `BK7F2A`), marks booking as `confirmed`, and dispatches an HTML confirmation email to the customer with restaurant venue details, party size, slot time, and pre-payment credit note.

#### Request Body
```json
{
  "restaurantId": "60d5ecb8b3b72c001f3e9c10",
  "bookingId": "60d5ecb8b3b72c001f3e9c22",
  "paymentId": "pay_mock_a1b2c3d4"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Booking payment verified & confirmation email sent",
  "data": {
    "_id": "60d5ecb8b3b72c001f3e9c22",
    "status": "confirmed",
    "couponCode": "BK7F2A",
    "prepayment": {
      "amount": 80,
      "status": "paid",
      "transactionId": "pay_mock_a1b2c3d4"
    }
  }
}
```

---

### 3. Staff Verify Coupon & Assign Table
`POST /api/v1/bookings/verify-coupon`

Staff enters the coupon code presented by the arriving guest, assigns a table, updates booking status to `seated`, and activates table QR scanning (`qrCode.isActive = true`).

#### Request Headers
`Authorization: Bearer <staff_jwt_token>`
`x-restaurant-id: 60d5ecb8b3b72c001f3e9c10`

#### Request Body
```json
{
  "couponCode": "BK7F2A",
  "tableNumber": "T-04"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Coupon code verified, table assigned & QR activated",
  "data": {
    "booking": {
      "id": "60d5ecb8b3b72c001f3e9c22",
      "status": "seated",
      "couponActivated": true
    },
    "table": {
      "tableNumber": "T-04",
      "qrCodeActive": true
    }
  }
}
```

---

### 4. Real-Time Walk-In Table Availability
`GET /api/v1/bookings/tables/available-for-walkin?numberOfPeople=4&bufferHours=2`

Finds vacant tables with sufficient capacity while excluding tables reserved for upcoming confirmed pre-bookings within the specified buffer window.

#### Request Headers
`Authorization: Bearer <staff_jwt_token>`
`x-restaurant-id: 60d5ecb8b3b72c001f3e9c10`

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Available tables for walk-in guests retrieved",
  "data": {
    "totalVacant": 5,
    "availableForWalkinCount": 4,
    "tables": [
      {
        "tableNumber": "T-01",
        "capacity": 4,
        "status": "vacant"
      }
    ],
    "reservedTableNumbers": ["T-02"]
  }
}
```

---

[← Orders API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/07-orders-api.md) | [Next: Inventory API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/09-inventory-api.md)
