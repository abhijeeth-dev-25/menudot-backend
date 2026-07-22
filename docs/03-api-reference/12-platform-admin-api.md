# Section 3.12: Platform Administration API Reference

[← Feedback & Campaigns API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/11-feedback-and-campaigns-api.md) | [Next: Database Schemas →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/01-core-and-users.md)

---

## 1. Get Pending Document Verification Queue
- **Method**: `GET`
- **Path**: `/api/v1/platform/restaurants/verification/pending`
- **Auth Required**: Platform Protected (`VERIFY_RESTAURANT_DOCS`)

---

## 2. Review Onboarding Application
- **Method**: `POST`
- **Path**: `/api/v1/platform/restaurants/onboarding/:restaurantId/review`
- **Auth Required**: Platform Protected (`APPROVE_RESTAURANT`)
- **Request Body**: `{ "action": "approve", "reviewNotes": "Documents verified." }`

---

## 3. View System Database Statistics
- **Method**: `GET`
- **Path**: `/api/v1/platform/system/stats`
- **Auth Required**: Platform Protected (`ACCESS_DB_TOOLS`)

---

## 4. Emergency Killswitch Controls
- **Method**: `POST`
- **Path**: `/api/v1/platform/system/emergency`
- **Auth Required**: Platform Protected (`EMERGENCY_CONTROLS`)

---

[← Feedback & Campaigns API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/11-feedback-and-campaigns-api.md) | [Next: Database Schemas →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/01-core-and-users.md)
