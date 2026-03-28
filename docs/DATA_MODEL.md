# Data Model

> Last updated: 2026-03-29 — Bug fixes: negative stock prevention enforced for OUT movements and order confirmation;
> CONFIRMED→CANCELLED now restores inventory. Added quantity cap (max 10,000/line) and totalCents overflow guard (~$21M).
> Future: migrate totalCents to Decimal/BigInt for enterprise-scale orders.

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
| status | Enum | ACTIVE, INACTIVE |
| isPlatformAdmin | Boolean | Super Admin flag |
| createdAt | DateTime | |

---

### Tenant (platform-owned record, tenant data container)

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | String | |
| slug | String | Unique, used in URLs |
| businessType | Enum | `general_retail`, `hardware`, `food_beverage`, `packaging_supply` — preset only, no logic |
| features | JSONB | Feature flags: `{ inventory, orders, payments, marketplace }` — all boolean |
| ownerId | UUID | FK → User |
| createdAt | DateTime | |

**Rules:**
- `businessType` is used ONLY for setting default feature flags on tenant creation. It must NOT control any logic.
- `features` is controlled by Super Admin only. Frontend must never mutate it directly.

---

### TenantMembership (tenant-owned)

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenantId | UUID | FK → Tenant |
| userId | UUID | FK → User |
| role | Enum | OWNER, ADMIN, MEMBER, VIEWER |
| status | Enum | ACTIVE, INACTIVE |
| createdAt | DateTime | |

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
| barcode | String | Optional — stored for future barcode/POS use (Phase 6) |
| createdAt | DateTime | |

**Rules:**
- `stockOnHand` must NEVER be mutated directly. All changes go through `InventoryMovement`.
- `barcode` is stored but not used in any logic until Phase 6.

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
- `OUT` movements are rejected if `quantity > stockOnHand` — negative stock is prevented at the service layer.
- `ADJUSTMENT` movements may produce negative stock intentionally (e.g. write-offs after a count). No guard on ADJUSTMENT.

---

### Order (tenant-owned) — MS5

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenantId | UUID | FK → Tenant |
| status | Enum | `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED` |
| totalCents | Int | Sum of all OrderItem (quantity × priceAtTime). Postgres `Int` — max ~$21M per order. |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Rules:**
- `totalCents` is computed at order creation and not updated afterward.
- Orders with a computed `totalCents` exceeding 2,147,483,647 (~$21M) are rejected with a 400 before insert.
- **Future:** migrate `totalCents` to `Decimal` or `BigInt` if enterprise-scale orders (>$21M) are required. Blocked on JSON serialization strategy for BigInt in NestJS responses.

---

### OrderItem (tenant-owned) — MS5

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| orderId | UUID | FK → Order |
| skuId | UUID | FK → Sku |
| quantity | Int | Max 10,000 per line item (DTO enforced) |
| priceAtTime | Int | Snapshot of SKU priceCents at order creation |

**Rules:**
- `priceAtTime` is captured at order creation and never updated — preserves historical accuracy.
- `quantity` is capped at 10,000 per line item via DTO validation. Split large orders across multiple line items or orders if needed.
- On order `CONFIRMED`, stock availability is checked inside a transaction before any movement is logged. Rejects if `stockOnHand < quantity` for any item.
- On order `CONFIRMED`, an `InventoryMovement` of type `OUT` is automatically logged per item and `stockOnHand` is decremented.
- On order `CANCELLED` from `CONFIRMED`, an `InventoryMovement` of type `IN` is automatically logged per item and `stockOnHand` is restored. Cancelling a `PENDING` order has no inventory effect.

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

---

## Future Models (DO NOT IMPLEMENT)

| Model | Phase |
|---|---|
| CustomerProfile | Phase 7 (Marketplace) |
| Cart / CartItem | Phase 7 (Marketplace) |
| MarketplaceListing | Phase 7 (Marketplace) |
| PosSession | Phase 6 (POS) |
