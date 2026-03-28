# Data Model

> Last updated: 2026-03-28 — Audit pass: added Tenant.status (ACTIVE/SUSPENDED, MS8), Sku.isArchived (MS8), Sku.lowStockThreshold (post-MVP), Order.customerRef/note (post-MVP). Fixed TenantMembership status field to use enum consistently.

---

## Ownership Rules

- Every table is either platform-owned or tenant-owned.
- Platform-owned tables have no `tenantId` (e.g., `Category`).
- Tenant-owned tables include `tenantId` and are ALWAYS filtered by it.
- `tenantId` must NEVER come from client input — always derive from authenticated context.

---

## Identifiers

- UUID primary keys on all tables.
- `tenantSlug` is a unique, human-readable identifier used in URLs (`/t/:tenantSlug/...`).

---

## Models

### User (platform-owned)

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| email | String | Unique |
| passwordHash | String | |
| status | Enum | `ACTIVE`, `INACTIVE` |
| isPlatformAdmin | Boolean | Super Admin flag |
| createdAt | DateTime | |

**Rules:**
- Users are never deleted. Deactivating memberships removes access.
- `isPlatformAdmin` is promoted via Super Admin API (MS8) or seed only.

---

### Tenant (platform-owned record, tenant data container)

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | String | |
| slug | String | Unique, used in URLs |
| status | Enum | `ACTIVE`, `SUSPENDED` — added MS8 |
| businessType | Enum | `general_retail`, `hardware`, `food_beverage`, `packaging_supply` — preset only, no logic |
| features | JSONB | Feature flags: `{ inventory, orders, payments, marketplace }` — all boolean |
| ownerId | UUID | FK → User |
| createdAt | DateTime | |

**Rules:**
- `status` defaults to `ACTIVE`. Super Admin can set to `SUSPENDED` — blocks all tenant access at the guard layer.
- Hard delete is NOT supported. Suspension is the permanent end state.
- `businessType` is used ONLY for setting default feature flags on tenant creation. It must NOT control any logic.
- `features` is controlled by Super Admin only. Frontend must never mutate it directly.

---

### TenantMembership (tenant-owned)

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenantId | UUID | FK → Tenant |
| userId | UUID | FK → User |
| role | Enum | `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` |
| status | Enum | `ACTIVE`, `INACTIVE` — deactivated = no access, record preserved |
| createdAt | DateTime | |

**Rules:**
- Memberships are deactivated (`status: INACTIVE`), never deleted. Preserves audit trail of who had access when.

---

### Category (platform-owned)

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | String | |
| slug | String | Unique |
| createdAt | DateTime | |

---

### Product (tenant-owned)

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenantId | UUID | FK → Tenant |
| categoryId | UUID | FK → Category |
| name | String | |
| description | String | Optional |
| createdAt | DateTime | |

---

### Sku (tenant-owned)

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenantId | UUID | FK → Tenant |
| productId | UUID | FK → Product |
| name | String | |
| priceCents | Int | Selling price in cents |
| costCents | Int | Cost price in cents — for profit tracking |
| stockOnHand | Int | Current stock — updated via InventoryMovement only |
| isArchived | Boolean | `false` by default — added MS8. Archived SKUs cannot be ordered but remain on historical records |
| lowStockThreshold | Int? | Optional — added post-MVP. Triggers `stock.low` notification when `stockOnHand` ≤ this value |
| barcode | String | Optional — stored for future barcode/POS use (Phase 6) |
| createdAt | DateTime | |

**Rules:**
- `stockOnHand` must NEVER be mutated directly. All changes go through `InventoryMovement`.
- `barcode` is stored but not used in any logic until Phase 6.
- `isArchived` SKUs are excluded from new order creation but remain on historical `OrderItem` records.

---

### InventoryMovement (tenant-owned) — MS4

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenantId | UUID | FK → Tenant |
| skuId | UUID | FK → Sku |
| type | Enum | `IN`, `OUT`, `ADJUSTMENT` |
| quantity | Int | Always positive — direction determined by `type` |
| referenceType | Enum | `ORDER`, `MANUAL` |
| referenceId | String | Optional — orderId if referenceType is ORDER |
| note | String | Optional — human-readable reason for MANUAL movements |
| createdAt | DateTime | |

**Rules:**
- Every stock change MUST create an `InventoryMovement` record.
- Backend enforces this — no silent stock updates.
- Negative stock prevention enforced in MS8 — reject if movement would push `stockOnHand` below zero.
- When a `CONFIRMED` order is cancelled, an `IN` movement is automatically logged to restore stock (enforced MS8).

---

### Order (tenant-owned) — MS5

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenantId | UUID | FK → Tenant |
| status | Enum | `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED` |
| totalCents | Int | Sum of all OrderItem (quantity × priceAtTime) |
| customerRef | String? | Optional — added post-MVP. e.g. "PO #12345", "Acme Corp". Staff-assigned reference. |
| note | String? | Optional — added post-MVP. Free-text internal note. |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### OrderItem (tenant-owned) — MS5

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| orderId | UUID | FK → Order |
| skuId | UUID | FK → Sku |
| quantity | Int | |
| priceAtTime | Int | Snapshot of SKU priceCents at order creation |

**Rules:**
- `priceAtTime` is captured at order creation and never updated — preserves historical accuracy.
- On order `CONFIRMED`, an `InventoryMovement` of type `OUT` is automatically logged per OrderItem.
- On order `CANCELLED` (from `CONFIRMED`), an `InventoryMovement` of type `IN` is automatically logged per OrderItem to restore stock.

---

### Payment (tenant-owned) — MS6

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenantId | UUID | FK → Tenant |
| orderId | UUID | FK → Order |
| amountCents | Int | |
| status | Enum | `PENDING`, `VERIFIED`, `REJECTED` |
| proofUrl | String | Optional — URL to uploaded proof of payment image |
| createdAt | DateTime | |

**Rules:**
- No payment gateway. Manual verification only.
- `proofUrl` is an optional plain string URL (e.g. Google Drive, image host). No file upload in MVP — S3/presigned URLs deferred to Phase 8.
- Staff verifies payment by reviewing proof and marking VERIFIED or REJECTED.
- Once VERIFIED or REJECTED, status cannot be changed again.
- Only one `PENDING` payment per order allowed at a time.
- Audit log events fired via Logger: `payment.submitted`, `payment.verified`, `payment.rejected`.

---

## Audit / Logging Events

| Event | Trigger |
|---|---|
| `order.created` | Order record created |
| `order.status_changed` | Order status updated |
| `payment.submitted` | Payment record created |
| `payment.verified` | Payment marked VERIFIED |
| `payment.rejected` | Payment marked REJECTED |
| `inventory.movement_logged` | Any InventoryMovement created |
| `stock.low` | stockOnHand ≤ lowStockThreshold after movement (post-MVP) |

---

## Future Models (DO NOT IMPLEMENT)

| Model | Phase |
|---|---|
| CustomerProfile | Phase 7 (Marketplace) |
| Cart / CartItem | Phase 7 (Marketplace) |
| MarketplaceListing | Phase 7 (Marketplace) |
| PosSession | Phase 6 (POS) |
| AuditLog | Post-MVP (queryable audit trail) |
| NotificationSettings | Post-MVP (per-tenant channel config for Messenger/email/SMS) |
