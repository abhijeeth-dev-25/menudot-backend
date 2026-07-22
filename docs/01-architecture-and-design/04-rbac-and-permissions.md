# Section 1.4: Role-Based Access Control (RBAC)

[← Security & Encryption](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/03-security-and-encryption.md) | [Next: Real-Time & Redis →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/05-realtime-and-redis.md)

---

## 1. Restaurant Domain Staff Roles

The restaurant operational context supports 5 granular roles checked via `restrictTo(...roles)` in middleware:

| Role | Access Scope | Specific Capabilities | Restrictions |
|---|---|---|---|
| `owner` | Complete Restaurant Scope | Create/delete staff accounts, view encrypted legal secrets, manage finance/P&L, update billing & bank details. | Cannot access other restaurant tenants. |
| `manager` | Operational Scope | Create categories/menu items, view live dashboard, manage tables, log expenses, manage bookings. | Cannot view raw legal secrets (PAN, Bank Account). Cannot create/delete Owner accounts. |
| `chef` | Kitchen & Menu Stock Scope | Kitchen Display System (KDS) access, change order state (`preparing`, `ready`), toggle item availability (`in stock` / `out of stock`). | Cannot access financial data, staff management, or table configuration. |
| `server` | Floor & Table Scope | View table layout, activate table QR scanning permissions (`qrCode.isActive = true`), receive service calls, update order status (`served`). | Cannot edit menu items, change prices, or access financial data. |
| `screen` | Tablet Token Scope | Scoped display for physical hardware tablets (KDS tablets, cashier tablets). | Restricted to `allowedTables` and `allowedServices`. |

---

## 2. Platform Administrative Domain Roles

Platform administration utilizes granular permission-based RBAC enforced via `restrictToPlatformPermission(permission)`:

| Role | Role Description | Key Assigned Permissions |
|---|---|---|
| `super_admin` | Global Root User | `*` (All permissions bypass checks automatically) |
| `platform_admin` | Platform Administrator | `approve_restaurant`, `suspend_restaurant`, `manage_platform_ads`, `view_system_reports` |
| `verification` | Document Officer | `verify_restaurant_docs`, `view_system_reports` |
| `operations` | Operations Staff | `view_system_reports`, `handle_support_tickets` |
| `finance` | Accounting Team | `view_financial_reports`, `manage_payouts` |
| `support` | Customer Support | `handle_support_tickets`, `view_restaurant_profile` |
| `safety` | Trust & Safety | `suspend_restaurant`, `audit_logs` |
| `sales` | Growth & Sales | `manage_platform_ads`, `view_sales_pipeline` |
| `tech` | Engineering | `access_db_tools`, `emergency_controls`, `view_system_logs` |

---

## 3. Scope Enforcement Middleware Flow

```text
HTTP Request
    │
    ▼
protect (Verifies JWT Bearer Token & extracts req.user)
    │
    ▼
Header Check (Verifies x-restaurant-id matches req.user.restaurantId)
    │
    ▼
restrictTo('owner', 'manager') OR restrictToPlatformPermission('verify_restaurant_docs')
    │
    ▼
Controller Execution
```

---

[← Security & Encryption](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/03-security-and-encryption.md) | [Next: Real-Time & Redis →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/05-realtime-and-redis.md)
