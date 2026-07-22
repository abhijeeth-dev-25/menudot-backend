# MenuDot Payment Gateway Architecture & Mock Provider Documentation

> **Module**: `gateways/payment`  
> **Status**: Production-Ready, Modular, Non-Destructive  
> **Default Mode**: `PAYMENT_MODE=mock`  

---

## 1. Executive Architecture Summary

MenuDot uses a provider-agnostic Payment Gateway Abstraction layer following **Clean Architecture** and **SOLID Principles**:

```text
Order Service / Controllers
         │
         ▼
  Payment Service  (Communicates ONLY with PaymentGatewayInterface)
         │
         ▼
Payment Gateway Interface (Contract: createOrder, verifyPayment, capturePayment, refund, cancelPayment)
         │
         ├─── (Factory: PAYMENT_MODE=mock) ────► Mock Payment Gateway (100% Offline Simulation)
         │
         └─── (Future: PAYMENT_MODE=razorpay) ─► Razorpay Gateway (Production SDK Wrapper)
```

---

## 2. Directory & Folder Structure

```text
src/
├── config/
│   └── env.js                          # Added PAYMENT_MODE schema & validation (default: 'mock')
├── gateways/
│   └── payment/
│       ├── interfaces/
│       │   └── paymentGateway.interface.js  # Base class contract for all payment providers
│       ├── mock/
│       │   └── mockPayment.gateway.js       # Offline mock simulation implementation
│       ├── factory/
│       │   └── payment.factory.js           # Environment-based gateway selector factory
│       └── types/
│           └── payment.types.js             # Shared payment enums (PaymentStatus, PaymentMethod)
├── models/
│   └── payment.model.js                # Mongoose Payment schema with auditablePlugin tenancy
├── repositories/
│   └── restaurant/
│       └── payment.repository.js       # Data access layer for payments
├── services/
│   └── restaurant/
│       └── payment.service.js          # Core payment business logic (communicates via interface)
├── validators/
│   └── payment.validator.js            # Joi validation schemas for payment payloads
├── controllers/
│   └── restaurant/
│       └── payment.controller.js       # Request handlers
├── routes/
│   └── restaurant/
│       └── payment.routes.js           # REST Endpoints (/api/v1/payments/*)
└── app.js                              # Mounted /api/v1/payments route handler
```

---

## 3. End-to-End Payment Flow

1. **Order Creation**: Client or Order Service requests payment creation via `POST /api/v1/payments/create`.
2. **Factory Selection**: `PaymentService` asks `PaymentFactory.getGateway()` for the active gateway. The service never knows whether it is using `mock`, `razorpay`, or `stripe`.
3. **Gateway Execution**: The active gateway creates a provider order payload with realistic IDs (`pay_mock_...`, `order_mock_...`, `txn_mock_...`).
4. **Database Persistence**: `PaymentRepository` saves the record with tenant scoping (`restaurantId`) and status `PENDING`.
5. **Verification**: When payment completes, `POST /api/v1/payments/verify` verifies the signature/status and updates the database state to `SUCCESS`.
6. **Refunds**: `POST /api/v1/payments/refund` processes provider refunds and records ledger details.

---

## 4. Environment Configuration & Switching Modes

Set `PAYMENT_MODE` in your `.env` file:

```ini
# Default Mode (Offline Mock Simulation - No API keys required)
PAYMENT_MODE=mock

# Future Production Modes:
# PAYMENT_MODE=razorpay
# PAYMENT_MODE=stripe
# PAYMENT_MODE=cashfree
# PAYMENT_MODE=phonepe
```

---

## 5. Development Mock Result Override Endpoint

In development mode, developers can force payment states (`SUCCESS`, `FAILED`, `PENDING`, `CANCELLED`, `TIMEOUT`) without external tools:

```http
POST /api/v1/payments/mock/result
Content-Type: application/json
Authorization: Bearer <accessToken>
x-restaurant-id: <restaurantId>

{
  "paymentId": "pay_mock_d1d1122f7a4731ab3896",
  "status": "SUCCESS"
}
```

> **Security Note**: This endpoint is guarded by `requireDevEnvironment` middleware and automatically returns `HTTP 403 Forbidden` if executed in `NODE_ENV=production`.

---

## 6. How to Add Razorpay Gateway (Future Extension)

Adding Razorpay or another gateway requires **ZERO** changes to `OrderService`, `PaymentService`, `PaymentController`, or existing business logic.

### Step-by-Step Instructions:

1. Create `src/gateways/payment/razorpay/razorpay.gateway.js`:

```javascript
const Razorpay = require('razorpay');
const PaymentGatewayInterface = require('../interfaces/paymentGateway.interface');
const { PaymentStatus } = require('../types/payment.types');

class RazorpayGateway extends PaymentGatewayInterface {
  constructor() {
    super();
    this.name = 'razorpay';
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  async createOrder(orderData) {
    const rzpOrder = await this.razorpay.orders.create({
      amount: orderData.amount * 100, // convert to paise
      currency: orderData.currency || 'INR',
      receipt: orderData.orderId,
    });

    return {
      gateway: this.name,
      paymentId: `pay_rzp_${rzpOrder.id}`,
      gatewayOrderId: rzpOrder.id,
      orderId: orderData.orderId,
      amount: orderData.amount,
      currency: rzpOrder.currency,
      status: PaymentStatus.PENDING,
    };
  }

  async verifyPayment(verificationData) {
    // Signature verification logic with crypto.createHmac...
  }

  async refund(refundData) {
    // Call this.razorpay.payments.refund...
  }
}

module.exports = RazorpayGateway;
```

2. Register in `src/gateways/payment/factory/payment.factory.js`:

```javascript
const RazorpayGateway = require('../razorpay/razorpay.gateway');

// Inside PaymentFactory constructor:
this.registerGateway('razorpay', new RazorpayGateway());
```

3. Update `.env`:
```ini
PAYMENT_MODE=razorpay
```

---

## 7. Automated Unit Tests

Run the dedicated payment test suite:

```bash
npx jest tests/payment.test.js
```

All payment endpoints and mock gateway flows operate 100% offline.
