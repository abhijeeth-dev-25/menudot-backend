# Section 4.3: Operations, Finance & Ads Models

[← Menu & Orders Schemas](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/02-menu-and-orders.md) | [Next: Deployment & Ops →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/05-deployment-and-ops/01-environment-and-setup.md)

---

## 1. `InventoryItem` & `InventoryTransaction`

- `InventoryItem`: `restaurantId`, `name`, `unit`, `currentStock`, `reorderThreshold`.
- `InventoryTransaction`: `inventoryItemId`, `quantity`, `transactionType` (`'in'`, `'out'`, `'wastage'`, `'audit_adjustment'`), `reason`.

---

## 2. `Expense` & `DailyFinanceReport`

- `Expense`: `restaurantId`, `category` (`'salaries'`, `'raw_materials'`, `'utilities'`, `'rent'`, `'maintenance'`, `'marketing'`), `amount`, `description`, `date`.
- `DailyFinanceReport`: `restaurantId`, `date`, `totalRevenue`, `grossSales`, `dineInSales`, `aggregatorSales`, `taxCollected`, `platformCommissions`, `totalExpenses`, `netProfit`.

---

## 3. `PlatformIntegration` & `AdCreative`

- `PlatformIntegration`: `restaurantId`, `platform` (`'swiggy'`, `'zomato'`, `'magicpin'`), `merchantId`, `apiKey`, `isEnabled`.
- `AdCreative`: `title`, `imageUrl`, `targetCuisines`, `targetCities`, `impressions`, `clicks`, `isActive`.

---

[← Menu & Orders Schemas](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/04-database-schemas/02-menu-and-orders.md) | [Next: Deployment & Ops →](file:///Users/abhijeethkar/Desktop/menudot-backend/docs/05-deployment-and-ops/01-environment-and-setup.md)
