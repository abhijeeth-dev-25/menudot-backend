# Section 3.13: Payment Gateway & Monetization API Reference

[← Platform Admin API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/12-platform-admin-api.md) | [Back to Documentation Portal →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/README.md)

---

## Endpoint Summary

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/payments/onboarding/initiate` | None (Public / Owner) | Initiates ₹1,950 Onboarding Security Fee payment (with optional coupon) |
| `POST` | `/api/v1/payments/onboarding/verify` | None (Public / Owner) | Verifies ₹1,950 payment, sets stage to `pending_approval`, generates GST invoice |
| `POST` | `/api/v1/payments/qr-order/initiate` | Bearer Token (Staff/Customer) | Initiates Table QR Order payment (with optional coupon) |
| `POST` | `/api/v1/payments/campaigns/initiate` | Bearer Token (Staff) | Initiates Merchant Ad Campaign spend payment |
| `POST` | `/api/v1/payments/subscriptions/initiate` | Bearer Token (Staff) | Initiates SaaS Software Subscription payment (Starter, Pro, Enterprise) |
| `GET` | `/api/v1/payments/settlement/daily` | Bearer Token (Staff) | Calculates daily merchant online payout settlement report |
| `POST` | `/api/v1/payments/create` | Bearer Token (Staff/Customer) | Generic low-level payment creation endpoint |
| `POST` | `/api/v1/payments/verify` | Bearer Token (Staff/Customer) | Generic payment verification endpoint |
| `POST` | `/api/v1/payments/refund` | Bearer Token (Staff) | Initiates full/partial refund |
| `GET` | `/api/v1/payments/history` | Bearer Token (Staff) | Retrieves tenant payment audit history |
| `POST` | `/api/v1/payments/mock/result` | Dev Mode Only | Forces mock payment status (`SUCCESS`, `FAILED`, `CANCELLED`, `TIMEOUT`) |

---

## Detailed Endpoint Contracts

### 1. Initiate Onboarding Security Deposit (₹1,950)
`POST /api/v1/payments/onboarding/initiate`

#### Request Body
```json
{
  "restaurantId": "60d5ecb8b3b72c001f3e9c10",
  "couponCode": "LAUNCH50"
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "message": "Onboarding security fee payment initiated (₹1,950)",
  "data": {
    "paymentId": "pay_mock_a9ec8d19335d",
    "gatewayOrderId": "order_mock_ab8e1bb65006",
    "amount": 1950,
    "currency": "INR",
    "status": "PENDING",
    "paymentCategory": "onboarding_security_fee",
    "appliedCoupon": {
      "code": "LAUNCH50",
      "discountAmount": 500,
      "originalAmount": 1950
    }
  }
}
```

---

### 2. Verify Onboarding Security Fee Payment
`POST /api/v1/payments/onboarding/verify`

Verifies payment, updates restaurant onboarding stage to `pending_approval`, and returns a structured **GST Tax Invoice**.

#### Request Body
```json
{
  "restaurantId": "60d5ecb8b3b72c001f3e9c10",
  "paymentId": "pay_mock_a9ec8d19335d"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Onboarding security deposit verified & stage updated to pending_approval",
  "data": {
    "onboardingStage": "pending_approval",
    "invoice": {
      "invoiceNumber": "INV-1784742292544-0347",
      "invoiceCategory": "ONBOARDING_SECURITY_DEPOSIT",
      "pricing": {
        "baseAmount": 1652.54,
        "totalGst": 297.46,
        "cgst": 148.73,
        "sgst": 148.73,
        "totalAmount": 1950
      }
    }
  }
}
```

---

[← Platform Admin API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/12-platform-admin-api.md) | [Back to Documentation Portal →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/README.md)
