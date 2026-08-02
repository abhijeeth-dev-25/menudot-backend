# Section 3.12: Platform Administration & Developer API Reference

[← Feedback & Campaigns API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/11-feedback-and-campaigns-api.md) | [Payment Gateway API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/13-payment-gateway-api.md)

---

## Overview

The **Platform Administration & Developer APIs** empower Platform Super Admins, Operations, Verification, and Technical teams to oversee multi-outlet onboardings, monitor system health, manage platform monetization, disburse merchant bank payouts, and audit aggregator webhooks.

---

## Endpoint Summary

| Method | Endpoint | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/platform/restaurants/onboarding/pending` | `VIEW_SYSTEM_REPORTS` | List pending onboarding applications (includes `pending_approval` + ₹1,950 fee metadata) |
| `GET` | `/api/v1/platform/restaurants/verification/pending` | `VERIFY_RESTAURANT_DOCS` | List pending document verification queue |
| `POST` | `/api/v1/platform/restaurants/onboarding/:id/verify` | `VERIFY_RESTAURANT_DOCS` | Toggle document check (PAN, GSTIN, FSSAI, Bank) |
| `POST` | `/api/v1/platform/restaurants/onboarding/:id/review` | `APPROVE_RESTAURANT` | Approve or reject restaurant application & send credentials email |
| `GET` | `/api/v1/platform/finance/overview` | `VIEW_FINANCIAL_REPORTS` | Platform financial dashboard (GMV, Onboarding Fees, SaaS, Ads, Commissions) |
| `GET` | `/api/v1/platform/finance/transactions` | `VIEW_FINANCIAL_REPORTS` | Global transaction audit ledger across all outlets |
| `POST` | `/api/v1/platform/finance/settlements/:id/disburse` | `MANAGE_PAYOUTS` | Disburse merchant daily bank payout & log audit trail |
| `PATCH` | `/api/v1/platform/finance/subscriptions/:id` | `MANAGE_PLANS` | Admin management of SaaS tiers (Starter, Pro, Enterprise) and trial extensions |
| `GET` | `/api/v1/platform/system/integrations/logs` | `VIEW_SYSTEM_LOGS` | Inspect Swiggy, Zomato & Magicpin integration webhook audit logs |
| `GET` | `/api/v1/platform/system/stats` | `ACCESS_DB_TOOLS` (Super Admin Scope) | Database collection statistics & system health (restricted to `super_admin`) |
| `POST` | `/api/v1/platform/system/emergency` | `EMERGENCY_CONTROLS` | Toggle global maintenance mode / emergency controls |
| `POST` | `/api/v1/platform/system/users` | `MANAGE_PLATFORM_ADMINS` | Provision platform admin staff accounts |

---

## Financial Control Tower & Merchant Disburser

### 1. Get Financial Overview
`GET /api/v1/platform/finance/overview`

```json
{
  "success": true,
  "message": "Platform financial overview retrieved",
  "data": {
    "overview": {
      "grossVolume": 154500.00,
      "onboardingFeesCollected": 19500.00,
      "subscriptionRevenue": 24990.00,
      "adSpendRevenue": 10000.00,
      "qrOrdersVolume": 100010.00,
      "platformCommissionEarned": 5000.50,
      "gatewayFeeExpense": 3090.00,
      "netPlatformRevenue": 56400.50
    },
    "outlets": {
      "totalOutlets": 15,
      "activeOutlets": 10
    }
  }
}
```

---

[← Feedback & Campaigns API](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/11-feedback-and-campaigns-api.md) | [Payment Gateway API →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/03-api-reference/13-payment-gateway-api.md)
