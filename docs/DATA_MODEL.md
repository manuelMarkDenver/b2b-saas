# Data Model

> Last updated: 2026-03-30 — MS9: TenantMembership.username (tenant-scoped, direct-add staff login), ADJUSTMENT negative stock floor, DATA_MODEL brought in sync with schema.
> 2026-03-29: Audit pass: added Tenant.status, Sku.isArchived, Sku.lowStockThreshold, Order.customerRef/note, fixed MembershipStatus enum.
> Bug fixes: negative stock prevention enforced (OUT movements + order confirmation + ADJUSTMENT floor); CONFIRMED→CANCELLED now restores inventory.
> Added quantity cap (max 10,000/line) and totalCents overflow guard (~$21M). Future: migrate totalCents to Decimal/BigInt.

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

**Post-MVP fields (i18n — add when i18n module ships):**
- `locale: String` — default `"en"`. Sets the UI language for all staff in this tenant unless overridden per user.
- `currency: String` — default `"PHP"`. Sets the display currency for prices and totals tenant-wide.

---

### TenantMembership (tenant-owned)

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenantId | UUID | FK → Tenant |
| userId | UUID | FK → User |
| role | Enum | `OWNER`, `ADMIN`, `STAFF`, `VIEWER` |
| status | Enum | `ACTIVE`, `INVITED`, `DISABLED` — deactivated = no access, record preserved |
| username | String? | Login identifier for direct-add staff (no email). Scoped per tenant — `@@unique([tenantId, username])`. Null for email-invited members. |
| jobTitle | String? | Optional display label (e.g. "Cashier", "Manager") |
| isOwner | Boolean | True only for the tenant creator |
| inviteToken | String? | Short-lived UUID for email invite flow |
| inviteExpiresAt | DateTime? | Invite expiry (48h from send) |
| createdAt | DateTime | |

**Rules:**
- Memberships are deactivated (`status: DISABLED`), never deleted. Preserves audit trail of who had access when.
- Direct-add staff: `User.email` is a placeholder (`direct-{uuid}@{slug}.internal`). Actual login credential is `membership.username` + business code (tenant slug) + password.
- Invited staff: `membership.username` is null. Login via email + password only.

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
- `OUT` movements are rejected if `quantity > stockOnHand` — negative stock is prevented at the service layer.
- `ADJUSTMENT` movements with a negative delta that would drop `stockOnHand` below 0 are also rejected.

---

### Order (tenant-owned) — MS5

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenantId | UUID | FK → Tenant |
| status | Enum | `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED` |
| totalCents | Int | Sum of all OrderItem (quantity × priceAtTime). Postgres `Int` — max ~$21M per order. |
| customerRef | String? | Optional — added post-MVP. e.g. "PO #12345", "Acme Corp". Staff-assigned reference. |
| note | String? | Optional — added post-MVP. Free-text internal note. |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Rules:**
- `totalCents` is computed at order creation and not updated afterward.
- Orders with a computed `totalCents` exceeding 2,147,483,647 (~$21M) are rejected with a 400 before insert.
- **Future:** migrate `totalCents` to `Decimal` or `BigInt` if enterprise-scale orders (>$21M) are required. Blocked on JSON serialization strategy for BigInt in NestJS responses.
- **Phase 7 addition:** add `source: Enum` (`INTERNAL` | `MARKETPLACE`) so tenants can distinguish manually-created orders from marketplace orders in their dashboard.

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
- Only one `PENDING` payment per order allowed at a time.
- Audit log events fired via Logger: `payment.submitted`, `payment.verified`, `payment.rejected`.

---

### Notification (platform/tenant-owned) — MS8

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenantId | UUID? | Null for Super Admin notifications; FK → Tenant for tenant-scoped events |
| userId | UUID | Recipient — FK → User |
| type | Enum | `ORDER_CREATED`, `ORDER_CONFIRMED`, `ORDER_CANCELLED`, `PAYMENT_SUBMITTED`, `PAYMENT_VERIFIED`, `PAYMENT_REJECTED`, `LOW_STOCK`, `STAFF_ADDED`, `TENANT_SUSPENDED`, `PLATFORM_ALERT` |
| title | String | Short label shown in the bell panel (e.g. "New order received") |
| body | String | Detail line (e.g. "Order #abc for $850 is awaiting confirmation") |
| entityType | String? | `order`, `payment`, `sku` — used to build the action link |
| entityId | UUID? | ID of the related entity — click navigates to it |
| isRead | Boolean | `false` by default. Set `true` when user opens or clicks the notification. |
| createdAt | DateTime | |

**Rules:**
- Written server-side only when the triggering event occurs — never created from the frontend.
- In-app notifications are always created; external channel dispatch is post-MVP and opt-in.
- `GET /notifications` returns the list scoped to the authenticated user plus an unread count for the badge.
- `PATCH /notifications/:id/read` marks one read. `PATCH /notifications/read-all` marks all read.
- `DELETE /notifications/:id` dismisses (hard-deletes) one notification.
- Notifications older than 90 days are purged on a scheduled job to prevent unbounded growth.
- `entityType` + `entityId` together form the action link. Frontend constructs the route (e.g. `/t/:slug/orders/:entityId`).

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

### Phase 7 — Marketplace

#### CustomerProfile

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| email | String | Unique — separate from User.email |
| passwordHash | String | |
| name | String | |
| locale | String? | Customer's preferred language |
| currency | String? | Customer's preferred display currency |
| createdAt | DateTime | |

**Rules:**
- Completely separate from `TenantMembership`. A customer is not a staff member.
- One global account — a customer can order from any tenant on the marketplace.
- Uses the same JWT auth pattern but issued as a customer token, not a staff token.

---

#### Cart (tenant-agnostic, scoped to customer)

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| customerId | UUID | FK → CustomerProfile |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### CartItem

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| cartId | UUID | FK → Cart |
| marketplaceListingId | UUID | FK → MarketplaceListing |
| skuId | UUID | FK → Sku |
| tenantId | UUID | FK → Tenant — denormalized for split-order logic |
| quantity | Int | |

**Rules:**
- A single cart can contain items from multiple tenants.
- At checkout, `CartItem` rows are grouped by `tenantId`. One `Order` is created per tenant group.
- `tenantId` is denormalized on `CartItem` to avoid joins during checkout split logic.

---

#### MarketplaceListing

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenantId | UUID | FK → Tenant |
| skuId | UUID | FK → Sku |
| marketplacePrice | Int? | Optional override of `Sku.priceCents` for marketplace display |
| isPublished | Boolean | `false` by default — staff must explicitly publish |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Rules:**
- Only tenants with `features.marketplace: true` can create listings.
- Archived SKUs (`isArchived: true`) cannot be listed.
- `marketplacePrice` allows tenants to sell at a different price on the marketplace vs internally.
- Delisting (`isPublished: false`) hides from browse but preserves historical order references.

---

### Phase 6 — POS

#### PosSession

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenantId | UUID | FK → Tenant |
| staffId | UUID | FK → User |
| status | Enum | `OPEN`, `CLOSED` |
| createdAt | DateTime | |
| closedAt | DateTime? | |

---

### Post-MVP

| Model | Phase | Notes |
|---|---|---|
| AuditLog | Post-MVP | Queryable audit trail — replaces logger-only events |
| UserNotificationPreferences | Post-MVP | Per-user channel opt-in: email / Messenger / WhatsApp / SMS + per-event subscription overrides |
| TenantRole | Post-MVP (Custom Roles) | Custom named roles: `id`, `tenantId`, `name`, `basedOn` (base role enum), `permissions` (JSONB overrides) |
| Integration | Post-MVP (Platform Integrations) | Connector config: `id`, `tenantId`, `type` (Shopee / Lazada / Custom / Courier), `config` (JSONB), `isActive` |
| IntegrationEvent | Post-MVP (Platform Integrations) | Append-only webhook event log: `id`, `integrationId`, `payload` (JSONB), `status` (OK / FAILED), `processedAt` |
