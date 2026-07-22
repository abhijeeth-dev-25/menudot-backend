# Section 3.10: Finance & Daily P&L API Reference

[← Inventory API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/09-inventory-api.md) | [Next: Feedback & Campaigns API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/11-feedback-and-campaigns-api.md)

---

## 1. Get Daily P&L Report
- **Method**: `GET`
- **Path**: `/api/v1/finance/daily`
- **Auth Required**: Protected (`owner`, `manager`)
- **Query Params**: `?date=2026-07-22`
- **Response (`200 OK`)**: Total revenue, taxes, platform commissions, logged expenses, and net daily profit/loss.

---

## 2. Add Operational Expense
- **Method**: `POST`
- **Path**: `/api/v1/finance/expense`
- **Auth Required**: Protected (`owner`, `manager`)
- **Request Body**:
  ```json
  {
    "category": "salaries",
    "amount": 45000,
    "description": "July Head Chef salary",
    "date": "2026-07-22"
  }
  ```

---

[← Inventory API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/09-inventory-api.md) | [Next: Feedback & Campaigns API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/11-feedback-and-campaigns-api.md)
