# Section 2.3: Table QR & Dual-Flow Access Management

[← Restaurant Setup](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/02-restaurant-setup.md) | [Next: KDS Order Lifecycle →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/04-kds-order-lifecycle.md)

---

## 1. Dual QR Activation Workflow Overview

MenuDot supports two distinct entry flows for table ordering access:

```text
       ┌─────────────────────────────────────────────────────────┐
       │             CUSTOMER ARRIVAL AT RESTAURANT              │
       └─────────────────────────────────────────────────────────┘
                                   │
                ┌──────────────────┴──────────────────┐
                ▼                                     ▼
     【Pre-Booked Coupon Guest】               【Direct Walk-In Guest】
                │                                     │
   Present confirmation email             Sit at vacant table & scan
     with Verification Coupon             inactive QR code token
                │                                     │
                ▼                                     ▼
   Staff calls POST /verify-coupon        System triggers staff alert
  Assigns table & verifies coupon        socket: staff:qr_unlock_request
                │                                     │
                ▼                                     ▼
  QR Code Directly Activated             Staff visits table & approves
    qrCode.isActive = true               POST /tables/:id/unlock-access
                │                                     │
                └──────────────────┬──────────────────┘
                                   │
                                   ▼
                ┌─────────────────────────────────────┐
                │     Customer Mobile App Unlocks     │
                │     Catalog Ready for Dine-in       │
                └─────────────────────────────────────┘
```

---

## 2. Detailed Access Modes

### Mode A: Pre-Booked Guests (Slot Booking + Coupon Verification)
1. Pre-booked guests present their confirmation email containing the 6-character Verification Coupon Code (e.g. `BK7F2A`).
2. Staff enters coupon code and assigns table via `POST /api/v1/bookings/verify-coupon`.
3. Because staff verifies details directly at the table/desk, the table QR code is **immediately activated** (`qrCode.isActive = true`, `status = 'occupied'`).
4. Guests scan table QR code and can order instantly.

### Mode B: Direct Walk-In Customers (Real-Time Staff Request & Unlock Approval)
1. Direct walk-in customers sit at a vacant table and scan the table QR code (`POST /api/v1/tables/scan`).
2. If `qrCode.isActive === false`:
   - Backend records a pending unlock request (`qrUnlockRequest: { requested: true, customerName, numberOfPeople, deviceId }`).
   - Dispatches a real-time WebSockets notification (`staff:qr_unlock_request`) to connected staff POS/KDS terminals.
   - Returns a structured HTTP 403 response with `status: 'activation_pending'`.
3. Staff receives the alert, visits the table, and approves access via `POST /api/v1/tables/:id/unlock-access`.
4. System sets `qrCode.isActive = true`, creates the `activeSession`, and emits `table:qr_unlocked` over WebSockets, automatically unlocking the customer's phone UI to display the menu catalog.

---

[← Restaurant Setup](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/02-restaurant-setup.md) | [Next: KDS Order Lifecycle →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/04-kds-order-lifecycle.md)
