# Section 2.1: Onboarding & Platform Verification Workflow

[← Architecture Overview](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/01-overview.md) | [Next: Restaurant Setup →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/02-restaurant-setup.md)

---

## 1. Process Overview

The onboarding workflow handles restaurant application submission, legal document encryption, platform compliance verification, and account credential provisioning.

```text
Restaurant Proprietor                Platform Verification Team             Platform Admin
         │                                       │                                 │
         │─── 1. POST /auth/register ───────────►│                                 │
         │    (Submits legal/bank details)       │                                 │
         │                                       │                                 │
         │                                       │─── 2. GET /verification/pending │
         │                                       │─── 3. POST /verify (Toggles) ──►│
         │                                       │                                 │
         │                                       │                                 │─── 4. POST /review (Approve)
         │◄────────────────────────────────────────────────────────────────────────────│
         │    5. Receives Owner Credentials      │                                 │
```

---

## 2. Step-by-Step Execution Flow

### Step 1: Restaurant Registration Submission
- **API**: `POST /api/v1/auth/register` (Public)
- **Data Submitted**:
  - Owner Profile: Full Name, Email, Mobile Number, WhatsApp Number.
  - Restaurant Details: Restaurant Name, Location (Address, City, State, Pincode), Operating Days & Hours, Outlet Type (Dine-in / Takeaway / Cloud Kitchen).
  - Legal & Financial Compliance: PAN, GSTIN, FSSAI License Number, Bank Account Number, Bank IFSC Code.
  - Menu Preferences: Food Type (Veg / Non-Veg / Both), Cuisines, Cost for Two, Packing Charges.
- **System Action**:
  - Hardware AES-256-GCM encrypts `ownerPan`, `gstin`, `bankDetails.accountNumber`, `bankDetails.ifscCode`, and `fssaiNumber`.
  - Creates a `Restaurant` document with `status: 'pending'`.
  - Sends email notification to platform onboarding team (`SMTP_COMPANY_RECEIVER`).

### Step 2: Document Verification Queue
- **API**: `GET /api/v1/platform/restaurants/verification/pending`
- **Role Required**: Platform user with `VERIFY_RESTAURANT_DOCS` permission.
- **System Action**: Retrieves pending applications and decrypts document strings for document verification officers to inspect.

### Step 3: Document Verification Toggling
- **API**: `POST /api/v1/platform/restaurants/onboarding/:restaurantId/verify`
- **Payload**: `{ "documentType": "ownerPan", "isVerified": true }`
- **System Action**: Updates the verification flag for individual documents.

### Step 4: Application Review & Approval
- **API**: `POST /api/v1/platform/restaurants/onboarding/:restaurantId/review`
- **Role Required**: Platform user with `APPROVE_RESTAURANT` permission.
- **Payload**: `{ "action": "approve", "reviewNotes": "All compliance documents verified." }`
- **System Action**:
  - Updates `Restaurant` status to `approved`.
  - Automatically provisions an `owner` staff user account in `User` collection.
  - Emails access credentials to the restaurant proprietor.

---

[← Architecture Overview](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/01-overview.md) | [Next: Restaurant Setup →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/02-restaurant-setup.md)
