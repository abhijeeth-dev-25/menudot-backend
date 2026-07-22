# Section 2.6: Table Checkout, Inventory & Financial P&L Workflow

[← Aggregator Integrations](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/05-aggregator-integrations.md) | [Next: API Reference →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/01-authentication-api.md)

---

## 1. Process Overview

This final operational workflow completes table settlement, enforces security QR lock deactivation, deducts raw material inventory, logs operational expenses, and generates daily P&L financial reports.

---

## 2. Execution Steps

### Step 1: Table Service Bill Request & Payment Settlement
1. Customer taps **Request Bill** on mobile QR UI.
2. Triggered API: `POST /api/v1/tables/:id/service` (`serviceType: 'bill'`).
3. Server receives real-time WebSocket alert `service_call_received`, accepts payment (Cash / UPI / Card), and marks orders as `completed`.

### Step 2: Table Checkout & Automated QR Security Locking
- **API**: `POST /api/v1/tables/:id/checkout`
- **Role Required**: `owner`, `manager`, `server`.
- **System Action**:
  - Resets table status: `status = 'vacant'`.
  - Clears device session: `activeSession = null`.
  - Deactivates QR scanning permissions: `qrCode.isActive = false`.
- **Security Outcome**: Table QR code immediately stops accepting scans until reactivated for the next party.

### Step 3: Raw Material Inventory Deduction
- Upon order completion, ingredients associated with ordered `MenuItem` documents are automatically deducted from `InventoryItem` stock.
- If current stock falls below `reorderThreshold`, the item is flagged on the inventory dashboard for restock.

### Step 4: Expense Logging & Daily P&L Finance Report
1. **Log Operational Costs**:
   - **API**: `POST /api/v1/finance/expense`
   - **Categories**: `salaries`, `raw_materials`, `utilities`, `rent`, `maintenance`, `marketing`.
2. **Generate Daily P&L Snapshot**:
   - **API**: `GET /api/v1/finance/daily?date=2026-07-22`
   - **Aggregated Output**:
     ```text
     Gross Sales (Dine-in + Aggregators)
     + GST Tax Collected
     - Platform Aggregator Commissions
     - Total Logged Operational Expenses
     ====================================
     = NET DAILY PROFIT / LOSS
     ```

---

[← Aggregator Integrations](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/05-aggregator-integrations.md) | [Next: API Reference →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/01-authentication-api.md)
