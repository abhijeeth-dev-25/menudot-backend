# Section 2.5: Multi-Platform Aggregator Sync Workflow

[← KDS & Order Lifecycle](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/04-kds-order-lifecycle.md) | [Next: Checkout, Inventory & Finance →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/06-checkout-inventory-finance.md)

---

## 1. Unified Aggregator Pipeline Overview

MenuDot aggregates online orders from Swiggy, Zomato, and Magicpin directly into the same Kitchen Display System (KDS) pipeline used for dine-in QR orders, preventing kitchen staff from having to manage multiple separate hardware tablets.

```text
 Swiggy Webhook           Zomato Webhook           Magicpin Webhook
       │                        │                         │
       └──────────────────┬─────┴─────────────────────────┘
                          │
                          ▼
             ┌─────────────────────────┐
             │  HMAC Signature Check   │
             │   (webhookAuth.js)      │
             └────────────┬────────────┘
                          │
                          ▼
             ┌─────────────────────────┐
             │ Standardized Ingestion  │
             │  (webhook.service.js)   │
             └────────────┬────────────┘
                          │
                          ▼
             ┌─────────────────────────┐
             │ Real-Time WebSocket     │
             │ Order Broadcast to KDS  │
             └─────────────────────────┘
```

---

## 2. Ingestion & Authorization Pipeline

### Step 1: Webhook Configuration
The restaurant owner stores aggregator API keys and secrets via `POST /api/v1/integrations`:
- Platform Credentials: `platform: 'swiggy'`, `merchantId: 'SW-9912'`, `apiKey: 'live_xxx'`.

### Step 2: Live Webhook Order Arrival
When a customer orders via Swiggy or Zomato, the external platform sends an HTTP POST request to MenuDot:
- **Endpoints**:
  - `POST /api/v1/webhooks/swiggy`
  - `POST /api/v1/webhooks/zomato`
  - `POST /api/v1/webhooks/magicpin`
- **HMAC Verification**: `webhookAuth` middleware verifies the SHA256 header signature against `SWIGGY_WEBHOOK_SECRET` or platform keys.

### Step 3: Schema Normalization & KDS Injection
- Parses platform-specific payloads into MenuDot's universal `Order` schema (`platform: 'swiggy'`, `externalOrderId: 'SW-99812'`).
- Saves order document in MongoDB and dispatches `order_created` WebSocket event to the kitchen display screen.

---

[← KDS & Order Lifecycle](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/04-kds-order-lifecycle.md) | [Next: Checkout, Inventory & Finance →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/06-checkout-inventory-finance.md)
