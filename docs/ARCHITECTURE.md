# Architecture

> Last updated: 2026-03-29 — Clarified marketplace as long-term goal (Phase 7), not abandoned.
> Added i18n/currency design, platform integrations vision, known challenges, and channel priority correction (Messenger > WhatsApp for PH/SEA).

---

## System Overview

This is a multi-tenant B2B business platform built ERP-first. The long-term vision includes a marketplace (Phase 7) — the ERP foundation comes first so tenants have real operational data (inventory, orders, payments) before opening a storefront.

- Modular monolith in a single repo (Turborepo)
- Shared database with `tenantId` enforced on all tenant-owned data
- Feature flags control which modules are available per tenant
- Marketplace, mobile, and POS are sequenced future phases — designed for but NOT built yet

---

## System Surfaces

### 1. Super Admin (Platform Owner)

- Creates and manages tenants
- Controls feature flags per tenant
- Has platform-level visibility across all tenants
- Accessed via platform admin routes (separate from tenant routes)

### 2. Tenant (Business Owner + Staff)

- Uses modules enabled by feature flags (inventory, orders, payments)
- Role-based access within the tenant (OWNER, ADMIN, MEMBER, VIEWER)
- Accessed via `/t/:tenantSlug/...`

### 3. Customer / Public (FUTURE ONLY — DO NOT BUILD)

- Marketplace-facing UI
- Multi-tenant product browsing and ordering
- Belongs to Phase 7 — prohibited from implementation now

---

## Processes

| Process | Framework | Purpose |
|---|---|---|
| `api` | NestJS | REST API, auth, business logic, tenant enforcement |
| `web` | Next.js | Tenant dashboard UI, Super Admin UI |
| `db` | Prisma + Postgres | Shared database, migrations, seed |

**Deployment:**
- Frontend: Vercel (Hobby)
- Backend: Render (Free tier)
- Database: Neon Postgres (Free tier)

---

## Module Boundaries (API)

| Module | Phase | Scope |
|---|---|---|
| `common/` | Always | Cross-cutting: config, logging, Prisma client, error handling |
| `auth/` | Phase 1 | Authentication (email/password) |
| `users/` | Phase 1 | User management |
| `tenants/` | Phase 1 | Tenant creation, management (Super Admin) |
| `tenant/` | Phase 1 | Active tenant context resolution |
| `memberships/` | Phase 1 | User-to-tenant associations |
| `catalog/` | Phase 2 | Categories, Products, SKUs |
| `inventory/` | Phase 3 | InventoryMovement logging and stock tracking |
| `orders/` | Phase 3 | Order and OrderItem management |
| `payments/` | Phase 3 | Manual payment submission and verification |
| `admin/` | Phase 4 | Super Admin dashboard and feature flag controls |

Modules for Phase 5+ (mobile, marketplace, POS) do NOT exist and must NOT be created.

---

## Feature Flag System

Each tenant has a `features` JSONB field:

```json
{
  "inventory": true,
  "orders": true,
  "payments": true,
  "marketplace": false
}
```

**Rules:**
- Feature flags are controlled by Super Admin only
- Routes check feature flags via guards before processing requests
- Business type (`businessType`) only sets default flags on tenant creation — it does NOT control logic
- `marketplace` flag is stored but its UI is not built until Phase 7

---

## Permission System (PBAC)

Roles define default permission bundles. Permissions can be overridden per membership.

| Role | Default Capabilities |
|---|---|
| OWNER | All permissions |
| ADMIN | Most permissions except tenant deletion |
| MEMBER | Operational permissions (create orders, log inventory) |
| VIEWER | Read-only |

Example capabilities: `can_manage_inventory`, `can_create_orders`, `can_verify_payments`

**Rules:**
- Role logic must NOT be hardcoded in business logic
- Permission checks use guards that read from membership capabilities
- Capabilities can be extended without changing role definitions

---

## Tenancy Model

- Platform-owned data: no `tenantId` (e.g., `Category`, `User`, `Tenant`)
- Tenant-owned data: required `tenantId` (e.g., `Product`, `Sku`, `Order`, `Payment`)
- `tenantId` is NEVER trusted from client input — always derived from authenticated session + membership check
- All service methods on tenant-owned resources must include `tenantId` in the `where` clause

---

## Web Routing

- Tenant-scoped routes: `/t/:tenantSlug/...`
- Super Admin routes: `/admin/...`
- No public marketplace routes in MVP

---

## App Shell Structure (MS8)

### Tenant sidebar

```
Dashboard
Inventory          (hidden if inventory feature flag disabled)
Orders             (hidden if orders feature flag disabled)
Payments           (hidden if payments feature flag disabled)
Catalog
  └── Products / SKUs
Settings
  ├── Tenant Profile
  ├── Team & Permissions    ← PBAC management UI
  └── Notifications         ← post-MVP (external channels)
```

### Super Admin sidebar

```
Dashboard
Tenants            (list, provision, suspend/reactivate)
Feature Flags      (per-tenant flag toggles)
Notifications      (platform-level alerts only)
```

### Team & Permissions page (PBAC UI)

Two tabs:

**Roles tab (read-only reference):**
Displays the default permission bundle for each role (OWNER, ADMIN, MEMBER, VIEWER) as a collapsible tree grouped by module. Used as a reference before assigning roles to staff — not editable.

**Members tab (editable):**
Lists all active members. Each row expands to show the member's role and all permissions as checkboxes, grouped by module. Permissions that differ from the role default are highlighted.

Permission group visibility:
- If a module feature flag is disabled by Super Admin, that group shows "Module not enabled" and is greyed out.
- Permissions outside the viewing user's scope are hidden (MEMBER can't see OWNER-only permissions).

Edit access:
| Acting role | Can edit |
|---|---|
| OWNER | ADMIN, MEMBER, VIEWER |
| ADMIN | MEMBER, VIEWER only |
| MEMBER / VIEWER | Read-only (own permissions visible in profile) |

Saving a permission override calls `PATCH /memberships/:id/permissions`.

### Notification center (in-app, MS8)

- Bell icon in top header. Badge shows unread count.
- Clicking opens a dropdown panel: title, body, timestamp, action link per notification.
- Clicking a notification navigates to the related entity and marks it read.
- Dismiss (×) removes a notification. "Mark all read" clears the badge.
- Fetches on open, polls every 60s. No WebSocket in MVP.

### Notification preferences (post-MVP)

Added to Settings → Notifications when external delivery channels ship. PBAC-derived matrix: rows = event types, columns = channels. Mandatory events (tied to permissions) are locked on. Events outside the user's permission scope are hidden. See Post-MVP Notifications section in MILESTONES.md.

---

## Inventory Integrity

- `stockOnHand` on `Sku` must NEVER be mutated directly
- All stock changes go through `InventoryMovement` records
- Backend enforces this — no exceptions

---

## Data Retention and Deletion Policy

**Immutable records (never delete or soft-delete):**
- `Order`, `OrderItem`, `Payment`, `InventoryMovement` — financial records. No delete endpoint, no `deletedAt`. Append-only by design.

**Archival pattern (entity-specific flag, not `deletedAt`):**
- `Product` / `Sku` — `isArchived: boolean` when introduced. Archived SKUs remain on historical orders but cannot be ordered again.

**Deactivation pattern:**
- `Membership` — `isActive: false` removes user access without destroying the record. Audit trail of who had access is preserved.
- `User` — never deleted. Memberships are deactivated instead.

**Tenant lifecycle:**
- `Tenant.status` enum: `ACTIVE | SUSPENDED`. Super Admin can suspend or reactivate.
- A suspended tenant is blocked at the guard layer — all data is preserved.
- Hard delete of a tenant is NOT supported (would cascade-destroy orders, payments, movements).

**Why not global soft deletes (`deletedAt` on every table):**
- Most entities should not be deletable at all — adding `deletedAt` implies deletion is valid.
- Requires `WHERE deletedAt IS NULL` on every query — easily forgotten, fragile over time.
- Entity-specific patterns (archival, suspension, deactivation) are explicit and fit the domain.

---

## White-Label Considerations

- Treat branding as data (tenant settings: name, logo, theme tokens)
- Keep platform name and tenant name separate in UI copy
- Do not bake tenant-specific assumptions into shared modules

---

## i18n + Currency

App-wide locale and currency are configurable — not hardcoded. Needed from the start because the platform targets global markets.

**Settings levels:**
- **Tenant default** — set in Settings → Tenant Profile. Applies to all staff without a personal override.
- **Per-staff override** — set in user account settings. Overrides tenant default for that user only.
- **Per-end-user** — Phase 7 (customer marketplace). Stored in customer profile.

**Schema additions (post-MVP, when this ships):**
- `Tenant`: `locale: String` (default `"en"`), `currency: String` (default `"PHP"`).
- `User`: `locale: String?`, `currency: String?` — null inherits from tenant default.

**Implementation:**
- Translation: `react-i18next` + `i18next`. Translation files in `apps/web/public/locales/`.
- Currency display: `Intl.NumberFormat`. No extra library.
- Stored values (`priceCents`) remain in cents — currency conversion is display-only.
- First locales: `en`, `fil`. Expand as needed.

---

## Platform Integrations (Future — Post-MVP)

Vision: this platform is the centralized inventory hub. Sales from any channel (Shopee, Lazada, a custom supplier system) deduct from the same `stockOnHand` — the dashboard always shows the real count.

**Architecture:**
- Each integration is a feature-flagged connector, disabled by default.
- Connectors create `InventoryMovement` records (`type: OUT`, `referenceType: INTEGRATION`) when an external sale occurs.
- Core inventory model is unchanged — integrations are just another movement source.
- Webhook payloads must be HMAC-verified before processing.

**PBAC additions:**
- `can_manage_integrations` — configure credentials, enable/disable connectors.
- `can_view_integration_log` — view event history.

**Planned connectors:** Shopee, Lazada, custom supplier/distributor API, courier APIs (J&T, LBC, Ninja Van).

See MILESTONES.md → Post-MVP: Platform Integrations for full design.

---

## External Notification Channels

Post-MVP. Channel priority for PH/SEA market:

1. **Email** — SMTP (already wired for password reset in MS8)
2. **Facebook Messenger** — Primary channel in PH. Meta Cloud API.
3. **WhatsApp Business** — Secondary. Meta Cloud API (same infrastructure).
4. **SMS** — Fallback. Twilio or Semaphore (PH local).

Dispatched async via BullMQ job queue (fire-and-forget, never blocks the request). Each channel is a swappable strategy implementation.

**Constraint:** Meta only allows free-form messages within a 24h reply window. Events sent outside that window require pre-approved message templates registered with Meta.

---

## Future Architecture (DO NOT IMPLEMENT YET)

| Future Capability | Phase | Notes |
|---|---|---|
| React Native mobile app | Phase 5 | Staff-focused, offline-first |
| POS layer + barcode scanning | Phase 6 | Reuses Orders + Payments backend |
| Marketplace | Phase 7 | See full design below and in MILESTONES.md |
| AWS scaling (ECS/RDS/S3/CloudFront) | Phase 8 | Subdomain routing per tenant. EKS if traffic demands it post-Phase 8. |

---

## Marketplace Architecture (Phase 7)

The marketplace is built on the existing ERP foundation — same inventory, same order model, same payment flow. No parallel systems.

### Routing (Phase 7 additions)

```
/marketplace                    → global browse (all tenants, all listings)
/marketplace/search?q=...       → cross-tenant search
/marketplace/category/:slug     → category-filtered browse
/shop/:tenantSlug               → per-tenant storefront (only that tenant's listings)
/shop/:tenantSlug/products/:id  → product detail
/account/...                    → customer account (orders, profile)
```

Existing routes (`/t/:tenantSlug/...`, `/admin/...`) are unchanged.

### System surfaces (Phase 7 additions)

- **Customer / Public** — browses global marketplace or per-tenant storefront. Has a `CustomerProfile` (separate from `TenantMembership`). One account, can order from any tenant.
- **Staff (listing management)** — existing staff roles extended with `can_manage_listings` permission. Publish/unpublish SKUs to the marketplace.

### Key architectural decisions

**Cart is multi-tenant aware.** A single cart can contain items from multiple tenants. At checkout, the cart splits into one `Order` per tenant. Each tenant fulfills their own orders.

**Inventory is shared.** A marketplace sale creates an `InventoryMovement` (type: `OUT`, referenceType: `ORDER`) just like a manual order. `stockOnHand` is always the real count regardless of sale origin.

**Order source tracking.** `Order` gets a `source` field (`INTERNAL` | `MARKETPLACE`) so tenants can distinguish internally-created orders from marketplace orders in their dashboard.

**Payment gateway is required.** Manual verification does not scale for customer-facing checkout. PayMongo (PH — GCash, Maya, cards) first, Stripe (global) second.

**Search.** Postgres full-text search at launch. Migrate to Meilisearch/Typesense when latency degrades under load.

**Customer auth is separate.** `CustomerProfile` uses the same JWT pattern but is a completely different entity from `TenantMembership`. A customer is not a staff member.
