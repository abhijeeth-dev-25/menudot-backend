# Section 2.7: Web Slot Booking, Verification Coupon & Walk-In Model

[← Checkout, Inventory & Finance](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/06-checkout-inventory-finance.md) | [Next: API Reference →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/08-bookings-dineout-api.md)

---

## 1. Process Overview

This module enables anonymous web customers to reserve dining slots by paying a ₹20/guest pre-booking fee, receiving an email confirmation containing a unique **Verification Coupon Code**. Upon arrival, restaurant staff verify the coupon code, assign a table, and activate QR scanning. During final table checkout, the pre-paid booking fee is automatically credited/deducted from the customer's dining bill.

Additionally, staff can allocate vacant tables to walk-in guests without disturbing pre-booked slots.

```text
Anonymous Web Customer                         Staff / Server                          System Engine
          │                                           │                                      │
          │── 1. POST /bookings/public/create ───────►│                                      │
          │   (Enters Name, Email, Mobile, Guests)    │                                      │
          │   Pre-payment = Guests * ₹20              │                                      │
          │                                           │                                      │
          │── 2. POST /bookings/public/verify-payment ─────────────────────────────────────►│
          │   (Payment Verified -> Coupon Code Issued)                                       │ (Sends Email via SMTP)
          │                                                                                  │ (Coupon Code: BK7F2A)
          │                                           │                                      │
          │── 3. Guests arrive & show email ─────────►│                                      │
          │                                           │── 4. POST /bookings/verify-coupon ──►│
          │                                           │    (Enters BK7F2A & Assigns Table)   │ (Activates Table QR)
          │                                           │                                      │ (Status -> Seated)
          │                                           │                                      │
          │◄── 5. Dine-in & Enjoy Meal ───────────────┤                                      │
          │                                           │                                      │
          │                                           │── 6. POST /tables/:id/checkout ─────►│ (Deducts ₹20/guest from
          │                                           │    (Calculates Final Bill)           │  final bill as prepaid discount)
```

---

## 2. Step-by-Step Execution Details

### Step 1: Anonymous Web Slot Booking (`POST /api/v1/bookings/public/create`)
- Customer selects restaurant, date, time slot, guest count, and enters contact details.
- System calculates pre-booking fee: `numberOfPeople * 20` (₹20 per guest).
- Creates a `Booking` record with `status: 'pending_payment'` and returns payment checkout payload.

### Step 2: Payment Verification & Email Dispatch (`POST /api/v1/bookings/public/verify-payment`)
- Verifies payment status via `PaymentService`.
- Generates a 6-character Verification Coupon Code (e.g. `BK7F2A`).
- Updates booking status to `confirmed` and prepayment status to `paid`.
- Sends an HTML confirmation email (`sendEmail`) containing:
  - **Verification Coupon Code**
  - **Restaurant Details**: Name, full address, contact number
  - **Customer Details**: Name, email, mobile
  - **Booking Info**: Date, time slot, party size
  - **Prepaid Credit Note**: Explaining automatic deduction at final checkout.

### Step 3: Staff Coupon Verification (`POST /api/v1/bookings/verify-coupon`)
- Guests present confirmation email.
- Staff enters `couponCode` and `tableNumber`.
- Sets booking status to `seated`, `couponActivated = true`, and activates table QR scanning (`qrCode.isActive = true`, `status = 'occupied'`).

### Step 4: Final Checkout & Bill Discount Deduction (`POST /api/v1/tables/:id/checkout`)
- On table checkout, the pre-paid booking fee is automatically applied as a discount on the final dining bill (`totals.discount += prebookingFee`, `totals.grandTotal -= prebookingFee`).
- Booking status updates to `completed`.

### Step 5: Real-Time Walk-In Table Allocation (`GET /api/v1/bookings/tables/available-for-walkin`)
- Evaluates vacant tables and excludes any tables reserved for upcoming confirmed pre-bookings within the next 2-hour buffer window.

---

[← Checkout, Inventory & Finance](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/06-checkout-inventory-finance.md) | [Next: API Reference →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/08-bookings-dineout-api.md)
