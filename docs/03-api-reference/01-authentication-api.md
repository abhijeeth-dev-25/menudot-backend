# Section 3.1: Authentication API Reference

[← Workflows Index](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/06-checkout-inventory-finance.md) | [Next: Restaurant Profile API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/02-restaurant-profile-api.md)

---

## 1. Register Restaurant Application
Submit public onboarding application with legal compliance documents.

- **Method**: `POST`
- **Path**: `/api/v1/auth/register`
- **Auth Required**: None (Public)
- **Request Body**:
  ```json
  {
    "ownerName": "John Doe",
    "restaurantName": "Gourmet Bistro",
    "location": { "address": "123 Main St", "city": "Bangalore", "state": "Karnataka", "pincode": "560001" },
    "email": "owner@gourmetbistro.com",
    "mobileNumber": "+919876543210",
    "whatsAppNumber": "+919876543210",
    "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    "openingTime": "10:00",
    "closingTime": "23:00",
    "outletType": "Dine-in & Takeaway",
    "ownerPan": "ABCDE1234F",
    "gstin": "29ABCDE1234F1Z5",
    "bankDetails": { "accountNumber": "91827364501", "ifscCode": "HDFC0001234" },
    "fssaiNumber": "11518000000123",
    "foodType": "Both",
    "cuisines": ["North Indian", "Italian"],
    "costForTwo": 1200,
    "packingCharges": 50
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "message": "Restaurant registration submitted successfully. Pending platform verification.",
    "data": { "restaurantId": "65b21...a1", "status": "pending" }
  }
  ```

---

## 2. User & Staff Login
Authenticate user or staff account and receive JWT access/refresh tokens.

- **Method**: `POST`
- **Path**: `/api/v1/auth/login`
- **Auth Required**: None (Public)
- **Request Body**:
  ```json
  {
    "email": "owner@gourmetbistro.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "accessToken": "eyJhbGci...",
      "refreshToken": "eyJhbGci...",
      "user": { "id": "65b...", "name": "John Doe", "role": "owner", "restaurantId": "65b21..." }
    }
  }
  ```

---

## 3. Refresh Access Token
Issue a new short-lived access token using a valid refresh token.

- **Method**: `POST`
- **Path**: `/api/v1/auth/refresh`
- **Auth Required**: None
- **Request Body**: `{ "refreshToken": "eyJhbGci..." }`
- **Response (`200 OK`)**: `{ "success": true, "data": { "accessToken": "eyJhbGci..." } }`

---

---

## 5. Founder Step-Up OTP Authorization

Request and verify 6-digit Step-Up OTP for protected operations on Founder account (`abhijeethkar.geddam.dev@gmail.com`).

### `POST /api/v1/auth/founder-otp/request`
Dispatches a 6-digit Step-Up OTP exclusively to `abhijeethkar.geddam.dev@gmail.com` with a 10-minute validity.

- **Auth Required**: None (Public)
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Step-Up OTP has been sent exclusively to abhijeethkar.geddam.dev@gmail.com",
    "data": { "expiresInSeconds": 600 }
  }
  ```

### `POST /api/v1/auth/founder-otp/verify`
Verifies the 6-digit OTP and returns a signed 15-minute `founderAuthToken`.

- **Auth Required**: None
- **Request Body**: `{ "otp": "123456" }`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Founder Step-Up OTP verified successfully",
    "data": { "founderAuthToken": "eyJhbGciOi..." }
  }
  ```

---

[← Workflows Index](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/06-checkout-inventory-finance.md) | [Next: Restaurant Profile API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/02-restaurant-profile-api.md)
