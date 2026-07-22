# Section 1.1: System Overview & Tech Stack

[← Back to Index](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/README.md) | [Next: Domain Isolation →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/02-domain-isolation.md)

---

## 1. Vision & Core Philosophy

**MenuDot** is an enterprise-grade multi-tenant SaaS platform engineered specifically for modern restaurants, cloud kitchens, and hospitality groups. It bridges in-restaurant customer dining experience with backend kitchen automation, multi-aggregator food delivery (Swiggy, Zomato, Magicpin), table booking (Dineout), inventory management, and financial P&L reporting.

---

## 2. High-Level System Architecture

```text
                               ┌─────────────────────────────────────────┐
                               │       Client Devices & Interfaces       │
                               │  - Mobile Web (Customer Table QR Scans) │
                               │  - POS Tablets (Kitchen KDS & Cashier)  │
                               │  - Platform Admin Dashboards            │
                               └────────────────────┬────────────────────┘
                                                    │
                                                    ▼
                               ┌─────────────────────────────────────────┐
                               │           HTTP & WebSockets API         │
                               │           Node.js + Express.js          │
                               │       (Port 5050 / Custom Reverse)     │
                               └──────────┬──────────────────┬───────────┘
                                          │                  │
                ┌─────────────────────────┴──┐            ┌──┴─────────────────────────┐
                │   Security & Scope Layers  │            │    Real-Time Event Layer   │
                │  - Rate Limiter & Helmet   │            │  - Socket.io WebSockets    │
                │  - JWT & Scoped Headers    │            │  - Room Scoped Dispatcher  │
                │  - AES-256 Field Encrypt   │            └────────────────────────────┘
                └─────────────┬──────────────┘
                              │
                              ▼
                ┌────────────────────────────┐
                │     Data & Cache Layer     │
                │  - MongoDB (Mongoose ORM)  │
                │  - Redis Resilient Cache   │
                │  - ImageKit CDN Storage    │
                └────────────────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js (v18+) | Non-blocking, asynchronous event loop engine |
| **Framework** | Express.js | Enterprise web framework for routing & middleware processing |
| **Database** | MongoDB + Mongoose ORM | NoSQL document storage with auditable schema plugins |
| **Caching & Locking** | Redis (`redis` client v4) | Session locking, token blacklists, high-throughput ad serving |
| **Real-Time Communication** | Socket.io | Bi-directional WebSocket rooms for kitchen orders & table calls |
| **Security & Encryption** | `crypto` (AES-256-GCM) | Hardware authenticated field encryption for legal documents |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`) | Stateless access tokens (15m) & refresh tokens (7d) |
| **Password Hashing** | `bcryptjs` | Salted password hashing (12 rounds) |
| **File Storage & CDN** | ImageKit SDK | Dynamic image optimization, thumbnailing, and public delivery |
| **Validation** | Joi | Declarative payload validation schemas |
| **Logging** | Pino (`pino-http`) | High-speed structured JSON logging |

---

## 4. Key Architectural Highlights

1. **Multi-Tenant Scoping**: Isolated database operations using standard `restaurantId` query wrappers.
2. **Device Session Locking**: Smart QR ordering with single-device active session enforcement per table.
3. **Multi-Aggregator Ingestion**: Standardized webhook handlers for Swiggy, Zomato, and Magicpin into a single Kitchen Display System (KDS).
4. **Resilient Infrastructure**: Redis fallback layers ensuring API stability even during cache cluster outages.

---

[← Back to Index](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/README.md) | [Next: Domain Isolation →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/02-domain-isolation.md)
