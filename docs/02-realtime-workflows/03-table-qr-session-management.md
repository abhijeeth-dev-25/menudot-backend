# Section 2.3: Table QR & Device Session Locking Workflow

[← Restaurant Setup](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/02-restaurant-setup.md) | [Next: KDS & Order Lifecycle →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/04-kds-order-lifecycle.md)

---

## 1. Security Architecture & QR Protection

To eliminate rogue scans, fake orders, and table hijacking in real-world busy dining environments, MenuDot enforces a two-tier security locking model:

```text
1. Floor Server Activation:  qrCode.isActive = true (Toggled when guests are seated)
2. Single-Device Lock:      activeSession.deviceId = <client_uuid> (Only 1 device per active table)
```

---

## 2. Step-by-Step Customer Scan Flow

```text
Customer Device                       Server Tablet App                        Backend API
       │                                     │                                      │
       │                                     │─── 1. PATCH /tables/:id/qr-toggle ──►│
       │                                     │    (Sets qrCode.isActive = true)     │
       │                                     │                                      │
       │─── 2. GET /tables/scan/:code ──────────────────────────────────────────────►│
       │    (Sends deviceId & customer details)                                     │
       │                                                                            │── 3. Check qrCode.isActive
       │                                                                            │── 4. Check activeSession
       │◄── 5. Returns Menu Catalog & Active Session Token ─────────────────────────│
```

---

## 3. Detailed Logic Enforcement

### Step 1: Waiter Enables QR Scanning
When guests arrive at Table T-04, the waiter taps the activate switch on their floor mobile app:
- **API**: `PATCH /api/v1/tables/:id/qr-toggle`
- **Payload**: `{ "isActive": true }`

### Step 2: Customer Scans QR Code
Customer opens their camera and scans the printed QR code containing unique cryptographic token `code`:
- **API**: `GET /api/v1/tables/scan/:code?customerName=John&numberOfPeople=3&deviceId=dev_xyz123`

### Step 3: Backend Security Verification
1. **QR Activation Guard**: Checks if `table.qrCode.isActive` is `true`. If `false`, returns HTTP `403 Forbidden` (*"Ordering is currently disabled for this table. Please ask a server to activate it."*).
2. **Device Session Lock**:
   - If `table.activeSession` is `null`: Creates a new session bound to `deviceId: 'dev_xyz123'`, sets table status to `occupied`, and returns the menu tree.
   - If `table.activeSession` exists AND `deviceId === 'dev_xyz123'`: Renews session timestamp and returns menu.
   - If `table.activeSession` exists AND `deviceId !== 'dev_xyz123'`: Returns HTTP `403 Forbidden` (*"A customer session is already active at this table."*).

---

[← Restaurant Setup](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/02-restaurant-setup.md) | [Next: KDS & Order Lifecycle →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/04-kds-order-lifecycle.md)
