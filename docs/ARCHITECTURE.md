# Architecture

> Last updated: 2026-03-28 — Realigned to ERP-lite modular platform. Removed marketplace references.
> Added system surfaces, feature flag system, PBAC, and module phase map.

---

## System Overview

This is a multi-tenant B2B business platform (ERP-lite foundation). It is NOT a marketplace.

- Modular monolith in a single repo (Turborepo)
- Shared database with `tenantId` enforced on all tenant-owned data
- Feature flags control which modules are available per tenant
- Future capabilities (marketplace, mobile, POS) are designed for but NOT built yet

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

## Inventory Integrity

- `stockOnHand` on `Sku` must NEVER be mutated directly
- All stock changes go through `InventoryMovement` records
- Backend enforces this — no exceptions

---

## White-Label Considerations

- Treat branding as data (tenant settings: name, logo, theme tokens)
- Keep platform name and tenant name separate in UI copy
- Do not bake tenant-specific assumptions into shared modules

---

## Future Architecture (DO NOT IMPLEMENT)

| Future Capability | Phase | Notes |
|---|---|---|
| React Native mobile app | Phase 5 | Staff-focused, offline-first |
| POS layer + barcode scanning | Phase 6 | Reuses Orders + Payments backend |
| Customer marketplace UI | Phase 7 | Multi-tenant selling, public browsing |
| AWS scaling (ECS/RDS/S3/CloudFront) | Phase 8 | Subdomain routing per tenant |
