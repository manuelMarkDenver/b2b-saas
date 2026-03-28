---
description: Evaluate whether a proposed feature is MVP-CRITICAL, MVP-ENHANCEMENT, or a FUTURE FEATURE
argument-hint: <feature description> (e.g. "barcode scanning on SKU", "order status filter by date range")
---

Evaluate the following proposed feature against the MVP boundary rules:

**Feature:** $ARGUMENTS

Use this classification system strictly:

**MVP-CRITICAL** — Required for the system to function at its current phase. Fits within:
- Auth, Users, Tenants, Memberships (Phase 1)
- Products, SKUs, Categories (Phase 2)
- InventoryMovement, Orders, OrderItems, Payments/manual (Phase 3)
- Feature flags, Super Admin basics (Phase 4)

**MVP-ENHANCEMENT** — Improves UX or DX but is not required. Should be deferred.

**FUTURE FEATURE** — Belongs to a future phase. Prohibited from implementation now:
- Mobile / React Native
- POS / barcode scanning
- Marketplace / customer-facing UI
- Payment gateways
- Advanced reporting
- Automation
- AWS scaling / subdomains

Output format:
1. **Classification:** MVP-CRITICAL / MVP-ENHANCEMENT / FUTURE FEATURE
2. **Reason:** One sentence explaining why
3. **Recommended action:** IMPLEMENT NOW / DEFER / DO NOT IMPLEMENT
4. **If deferred/prohibited:** Which phase it belongs to (Phase 5–8)
