# Section 3.13: Payment Gateway & Mock Provider API Reference

[← Platform Admin API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/12-platform-admin-api.md) | [Next: Database Schemas →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/01-core-and-users.md)

---

## 1. Create Payment Order
- **Method**: `POST`
- **Path**: `/api/v1/payments/create`
- **Auth Required**: Protected (`owner`, `manager`, `server`)
- **Request Body**:
  ```json
  {
    "amount": 750,
    "currency": "INR",
    "orderId": "ORD_TABLE_4",
    "paymentMethod": "upi",
    "metadata": { "note": "Lunch order" }
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "message": "Payment order created successfully",
    "data": {
      "paymentId": "pay_mock_d1d1122f7a4731ab3896",
      "gatewayOrderId": "order_mock_79900dd5f1c28a6bf1f0",
      "amount": 750,
      "status": "PENDING"
    }
  }
  ```

---

## 2. Verify Payment
- **Method**: `POST`
- **Path**: `/api/v1/payments/verify`
- **Auth Required**: Protected
- **Request Body**: `{ "paymentId": "pay_mock_d1d1122f7a4731ab3896" }`
- **Response (`200 OK`)**: `{ "success": true, "data": { "status": "SUCCESS", "transactionId": "txn_mock_xxx" } }`

---

## 3. Process Refund
- **Method**: `POST`
- **Path**: `/api/v1/payments/refund`
- **Auth Required**: Protected (`owner`, `manager`)
- **Request Body**: `{ "paymentId": "pay_mock_xxx", "amount": 750, "reason": "Customer cancellation" }`

---

## 4. Get Payment Details & History
- **GET** `/api/v1/payments/:id` — Retrieve single payment details.
- **GET** `/api/v1/payments/history` — List payment history for tenant.

---

## 5. Development Mock Result Override
- **Method**: `POST`
- **Path**: `/api/v1/payments/mock/result`
- **Auth Required**: Protected (Development Only)
- **Request Body**: `{ "paymentId": "pay_mock_xxx", "status": "SUCCESS" }`

---

[← Platform Admin API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/12-platform-admin-api.md) | [Next: Database Schemas →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/01-core-and-users.md)
