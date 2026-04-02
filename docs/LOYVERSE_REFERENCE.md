# Loyverse Feature Reference

> Source: Screenshots from cousin accountant (real active user) managing brother's business — Manager's Pizza + Megabox. Captured 2026-04-02.
>
> Purpose: Competitive gap analysis. These are features a real operator **already relies on** day-to-day. Use this to prioritize what we build next and what we can position against.

---

## Context

The cousin uses Loyverse as the current POS + inventory system. She sent these screenshots to show what she is actively using. These represent **real operational needs**, not hypothetical feature requests. When we replace Loyverse for the first client, we need parity on the near-future items.

---

## Reports (Screenshot 1 + 2)

### What Loyverse shows

**Sales Summary page:**
- Gross sales, Refunds, Discounts, Net sales, Gross profit — side by side at the top
- Period-over-period delta (e.g. +5%, +2.16%)
- Date range picker (e.g. Mar 4 – Apr 2, 2026)
- Employee filter
- Daily area chart of gross sales

**Full reports menu:**
| Report | Description |
|--------|-------------|
| Sales summary | Aggregate KPIs for a date range |
| Sales by item | Revenue per product |
| Sales by category | Revenue per category |
| Sales by employee | Revenue attributed per staff member |
| Sales by payment type | Cash vs GCash vs Maya etc. |
| Receipts | View/print individual receipts |
| Sales by modifier | Add-on/modifier breakdown |
| Discounts | Total discounts given, by type |
| Taxes | Tax collected breakdown |
| Shifts | Cash register shift open/close log |

### Zentral status

| Report | Status | Tag |
|--------|--------|-----|
| Sales summary (gross/net/profit) | Partial — basic dashboard exists | `NEAR_FUTURE` |
| Period-over-period deltas | Not built | `NEAR_FUTURE` |
| Employee filter on reports | Not built | `NEAR_FUTURE` |
| Sales by item | Not built | `NEAR_FUTURE` |
| Sales by category | Not built | `NEAR_FUTURE` |
| Sales by payment type | Not built | `NEAR_FUTURE` |
| Receipts (print/view) | Not built | `NEAR_FUTURE` |
| Sales by employee | Not built — needs shift tracking first | `FUTURE` |
| Sales by modifier | Out of scope (no modifier system) | `FUTURE` |
| Discounts | No discount system yet | `FUTURE` |
| Taxes | No line-item tax system | `FUTURE` |
| Shifts (cash register) | Not built | `FUTURE` |

---

## Inventory Management (Screenshot 3)

Loyverse's "Advanced Inventory" is a paid add-on. The cousin is using or evaluating it. All features listed below.

| Feature | Description | Zentral status | Tag |
|---------|-------------|----------------|-----|
| Purchase orders | Plan purchases, export to suppliers, track receipts, manage vendor relationships | Not built | `NEAR_FUTURE` |
| Transfer orders | Create transfer orders and move stock between stores | Built (history-only, deferred from nav) | `NEAR_FUTURE` — real movement blocked pending branch model |
| Stock adjustments | Increase/decrease stock for received items, damages, loss | Partial — inventory movements exist but no clean adjustment UI | `NEAR_FUTURE` |
| Inventory counts | Full or partial stocktakes, barcode scanner or manual | Not built | `FUTURE` |
| Production | Track stock of items produced from ingredients (BOM) | Not built — completely different domain | `FUTURE` |
| Inventory history | View adjustment log | Partial — movements exist but no UI | `NEAR_FUTURE` |
| Inventory valuation report | Cost vs potential profit of inventory | Not built | `FUTURE` |
| Label printing | Print barcode labels for POS, purchase orders, inventory counts | Not built — requires hardware integration | `FUTURE` |

---

## Employees (Screenshot 4)

| Feature | Description | Zentral status | Tag |
|---------|-------------|----------------|-----|
| Employee list | Staff roster | Partial — memberships/team exists | `NEAR_FUTURE` — UI polish needed |
| Access rights | Role-based permissions per employee | Partial — role system exists, PBAC deferred | `NEAR_FUTURE` |
| Timecards | Clock in/out per employee | Not built | `FUTURE` |
| Total hours worked | Aggregate hours report | Not built | `FUTURE` |

---

## Priority Summary

### NEAR_FUTURE — Build post-staging, before expanding to next client

These are things the cousin already uses and will notice are missing when we migrate away from Loyverse:

1. **Sales by item + Sales by category** — highest-impact reports, directly tied to what she checks daily
2. **Sales by payment type** — critical for cash reconciliation (GCash vs cash vs Maya)
3. **Receipts** — need at minimum a printable/shareable receipt per order
4. **Period-over-period deltas on dashboard** — the "+5%" comparison is a daily health check signal
5. **Purchase orders** — supplier restocking workflow, especially for Megabox (warehouse context)
6. **Stock adjustments UI** — damages, shrinkage, manual corrections
7. **Inventory history UI** — audit trail of all stock movements
8. **Access rights / RBAC UI** — currently deferred (MS8), but real operators expect role controls

### FUTURE — Build after revenue validates investment

- Shifts (cash register session management)
- Sales by employee (requires shift tracking first)
- Inventory counts / stocktake
- Production / BOM (ingredient-level tracking)
- Inventory valuation report
- Label printing
- Timecards / hours worked
- Taxes (line-item)
- Discounts (line-item or order-level)

---

## Notes

- Loyverse's Advanced Inventory is a **paid upgrade** — meaning the cousin's business is already paying extra for features like purchase orders and transfer orders. This is a direct upsell opportunity for Zentral.
- The "Sales by employee" + "Timecards" combo suggests staff accountability is important to how this business is managed. Keep in mind for RBAC + shift work.
- "Production" (ingredients tracking) is a big signal for Manager's Pizza specifically — pizza kitchens work on BOMs (dough → pizza). This is a future phase but it's a real need for that client.
