# Section 3.11: Feedback & Growth Campaigns API Reference

[← Finance & P&L API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/10-finance-and-pl-api.md) | [Next: Platform Admin API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/12-platform-admin-api.md)

---

## 1. Submit Customer Feedback
- **Method**: `POST`
- **Path**: `/api/v1/feedback/public`
- **Auth Required**: Public
- **Request Body**: `{ "restaurantId": "65b...", "rating": 5, "comments": "Excellent food and fast table service!" }`

---

## 2. Create Merchant Marketing Campaign
- **Method**: `POST`
- **Path**: `/api/v1/campaigns`
- **Auth Required**: Protected (`owner`, `manager`)
- **Request Body**: `{ "name": "Monsoon 20% Off", "discountType": "percentage", "discountValue": 20, "startDate": "2026-08-01", "endDate": "2026-08-15" }`

---

## 3. Serve Customer Platform Ad
- **Method**: `GET`
- **Path**: `/api/v1/platform/ads/serve`
- **Auth Required**: Public

---

[← Finance & P&L API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/10-finance-and-pl-api.md) | [Next: Platform Admin API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/12-platform-admin-api.md)
