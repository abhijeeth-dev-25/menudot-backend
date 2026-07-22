# Section 1.5: Real-Time WebSockets & Resilient Redis

[← RBAC & Permissions](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/04-rbac-and-permissions.md) | [Next: Real-Time Workflows →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/01-onboarding-and-verification.md)

---

## 1. Socket.io Real-Time WebSockets Architecture

Real-time communication is attached directly to the Express HTTP server instance via `utils/socket.js`.

### Socket Handshake Authentication
When connecting, web components (KDS tablets, floor server mobile apps, customer web apps) pass the JWT token:

```javascript
const socket = io('https://api.menudot.com', {
  auth: { token: 'Bearer <accessToken>' }
});
```

### Room Subscriptions & Event Isolation
Upon authentication, sockets automatically join their restaurant room: `restaurant_<restaurantId>`. Physical hardware screens further filter events based on `allowedTables` and `allowedServices`.

### Server-Emitted Real-Time Events

| Event Name | Trigger | Payload Summary | Target Audience |
|---|---|---|---|
| `order_created` | Dine-in QR order placed or Swiggy/Zomato webhook received | `{ orderId, tableNumber, platform, items, status }` | Kitchen Display System (Chef screens) |
| `order_updated` | Order status changes (`preparing`, `ready`, `served`) | `{ orderId, tableNumber, newStatus }` | Kitchen, Server tablets, Customer UI |
| `service_call_received` | Customer taps water/bill/cleaning button | `{ tableId, tableNumber, serviceType, note }` | Floor Server devices |

---

## 2. Resilient Redis Cache & Session Locking

Redis (`src/database/redis.js`) handles session locks, token revocation lists, and high-frequency ad serving.

### Resilient Execution Wrapper (`safeRedisCall`)
If Redis goes down or experiences network jitter, `safeRedisCall` catches exceptions gracefully and returns fallbacks without interrupting API request handling:

```javascript
const data = await safeRedisCall(
  async (client) => await client.get(`session:${tableId}`),
  null // Fallback value if Redis is unreachable
);
```

### Redis Key Schemas

| Key Pattern | Purpose | Expiry |
|---|---|---|
| `session:table:<tableId>` | Tracks active customer `deviceId` for session locking | Cleared on checkout |
| `token:blacklist:<jti>` | Revoked refresh tokens | 7 Days |
| `ads:targeting:<campaignId>` | Cached targeting rules for rapid ad serving | 1 Hour |

---

[← RBAC & Permissions](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/01-architecture-and-design/04-rbac-and-permissions.md) | [Next: Real-Time Workflows →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/02-realtime-workflows/01-onboarding-and-verification.md)
