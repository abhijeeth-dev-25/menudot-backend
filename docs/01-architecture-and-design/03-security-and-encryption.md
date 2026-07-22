# Section 1.3: Security & Encryption Architecture

[← Domain Isolation](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/02-domain-isolation.md) | [Next: RBAC & Permissions →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/04-rbac-and-permissions.md)

---

## 1. Hardware-Grade AES-256-GCM Field Encryption

Legal documents and financial account numbers submitted by restaurants during onboarding are encrypted before hitting MongoDB storage using `AES-256-GCM` with dynamic initialization vectors (IV) and authentication tags.

### Encrypted Legal Fields (`Restaurant` Model)
- Owner PAN (`ownerPan`)
- GSTIN Registration (`gstin`)
- Bank Account Number (`bankDetails.accountNumber`)
- Bank IFSC Code (`bankDetails.ifscCode`)
- FSSAI License Number (`fssaiNumber`)

```text
Plaintext String ──► AES-256-GCM (Key: FIELD_ENCRYPTION_KEY) ──► Encrypted String (iv:tag:ciphertext)
```

Only authenticated `owner` staff members or authorized `verification` platform officers can view decrypted versions of these fields.

---

## 2. Authentication & Token Architecture

MenuDot uses a stateless, dual-token system:

1. **Access Token (15 Minutes Expiry)**:
   - Header: `Authorization: Bearer <accessToken>`
   - Payload contains: `userId`, `email`, `role`, `permissions`, `restaurantId`.
2. **Refresh Token (7 Days Expiry)**:
   - Sent to `POST /api/v1/auth/refresh` to obtain new access tokens.
3. **Password Hashing**:
   - Standard passwords are salted and hashed using `bcryptjs` with 12 rounds.

---

## 3. Webhook Signature Verification (`webhookAuth.js`)

External aggregators (Swiggy, Zomato, Magicpin) deliver live orders via POST webhooks. To prevent request spoofing, MenuDot validates HMAC-SHA256 signatures:

```javascript
// Example Swiggy signature validation
const computedSignature = crypto
  .createHmac('sha256', process.env.SWIGGY_WEBHOOK_SECRET)
  .update(req.rawBody)
  .digest('hex');

if (req.headers['x-swiggy-signature'] !== computedSignature) {
  throw new AppError(401, 'Invalid webhook signature');
}
```

---

## 4. Network Security & HTTP Hardening

- **Helmet.js**: Injects secure HTTP security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`).
- **Rate Limiting**: Rate limiter prevents brute force attacks by capping API calls to 1000 requests per 15 minutes per IP (`RATE_LIMIT_MAX`).
- **Payload Sanitization**: JSON body limit set to 10MB to block memory exhaustion attacks.

---

[← Domain Isolation](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/02-domain-isolation.md) | [Next: RBAC & Permissions →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/04-rbac-and-permissions.md)
