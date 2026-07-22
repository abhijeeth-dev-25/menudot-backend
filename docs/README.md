# MenuDot Documentation Portal

Welcome to the official, multi-page technical documentation for **MenuDot Backend**.

This documentation is structured into modular sections for clear reading, easy maintainability, and step-by-step guidance for developers, platform operators, and restaurant managers.

---

## 📚 Table of Contents

### 1. 🏗️ Architecture & Core Design
- [01-1. System Overview & Tech Stack](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/01-overview.md) — Multi-tenancy, tech stack, domain separation.
- [01-2. Domain Isolation & Directory Layout](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/02-domain-isolation.md) — Platform vs Restaurant code separation.
- [01-3. Security & AES-256 Encryption](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/03-security-and-encryption.md) — Hardware encryption, JWT tokens, webhook signatures.
- [01-4. Role-Based Access Control (RBAC)](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/04-rbac-and-permissions.md) — Restaurant staff roles & platform administration permissions.
- [01-5. Real-Time WebSockets & Resilient Redis](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/05-realtime-and-redis.md) — Socket.io events & Redis caching fallback.

### 2. ⚡ Real-Time Restaurant Workflows
- [02-1. Onboarding & Platform Verification](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/01-onboarding-and-verification.md) — Application submission, KYC check, account approval.
- [02-2. Restaurant Setup & Provisioning](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/02-restaurant-setup.md) — Catalog setup, staff roles, KDS screen provisioning.
- [02-3. Table QR & Device Session Locking](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/03-table-qr-session-management.md) — QR activation, 1-device lock, customer scan flow.
- [02-4. Kitchen Display System (KDS) & Order Lifecycle](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/04-kds-order-lifecycle.md) — Real-time state machine (`received` → `preparing` → `ready` → `served` → `completed`).
- [02-5. Multi-Platform Aggregator Sync](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/05-aggregator-integrations.md) — Swiggy, Zomato, Magicpin webhooks & unified order ingestion.
- [02-6. Table Checkout, Inventory & Financial P&L](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/06-checkout-inventory-finance.md) — Session clearance, auto QR locking, stock deduction, daily P&L.
- [02-7. Web Slot Booking, Verification Coupon & Walk-In Model](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/07-web-slot-booking-and-walkin.md) — Anonymous slot pre-payment, email coupon, table assignment & walk-in table allocation.

### 3. 🔌 API Endpoint Reference
- [03-1. Authentication API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/01-authentication-api.md) — Register, Login, Refresh, Logout.
- [03-2. Restaurant Profile API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/02-restaurant-profile-api.md) — Profile fetch, operating hours, legal document view.
- [03-3. Staff & Screen Management API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/03-staff-and-screens-api.md) — User creation, role assignment, tablet provisioning.
- [03-4. Table & QR Ordering API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/04-table-and-qr-api.md) — QR scan, service requests, QR toggle, checkout.
- [03-5. Menu Catalog API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/05-menu-catalog-api.md) — Categories, items, ImageKit upload, stock toggle.
- [03-6. Orders & KDS API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/06-orders-and-kds-api.md) — Order creation, filtering, KDS status updates.
- [03-7. Aggregators & Webhooks API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/07-aggregator-and-webhooks-api.md) — Swiggy, Zomato, Magicpin webhooks & credentials.
- [03-8. Dineout Bookings API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/08-bookings-dineout-api.md) — Public table reservation & booking management.
- [03-9. Inventory & Raw Materials API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/09-inventory-api.md) — Raw material stock logging & reorder alerts.
- [03-10. Finance & Daily P&L API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/10-finance-and-pl-api.md) — Expense entry & daily financial reporting.
- [03-11. Feedback & Growth Campaigns API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/11-feedback-and-campaigns-api.md) — Sentiment reviews, merchant campaigns, platform ads.
- [03-12. Platform Administration API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/12-platform-admin-api.md) — Verification queue, onboarding approval, emergency controls.

### 4. 🗄️ Database Schemas & Data Models
- [04-1. Core & User Models](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/01-core-and-users.md) — `Restaurant`, `User`, `Table`, `Screen`.
- [04-2. Catalog & Order Models](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/02-menu-and-orders.md) — `MenuItem`, `MenuCategory`, `Order`, `Booking`.
- [04-3. Operations, Finance & Ads Models](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/03-inventory-finance-ads.md) — `InventoryItem`, `Expense`, `DailyFinanceReport`, `AdCreative`, etc.

### 5. 🚀 Deployment & Operations
- [05-1. Environment & Setup Guide](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/05-deployment-and-ops/01-environment-and-setup.md) — `.env` reference, local running, production setup, health check endpoints.

---

*MenuDot Backend Modular Documentation*
