# Milestones

This project is delivered milestone-by-milestone. Do not pull work forward.

> Last updated: 2026-03-28 — Realigned from marketplace-first to ERP-lite modular platform.
> Marketplace, mobile, and POS are future phases (Phase 5+). Do NOT implement.

---

## Milestone 1 - Foundation ✅

Definition of done:

- Repo scaffold: `apps/api`, `apps/web`, `packages/db`, `infra/`.
- Local Postgres via Docker Compose.
- Prisma wired and first migration runs.
- API boots, connects to DB, `GET /health` works.
- Web boots, calls API health endpoint.
- Structured application logging (request id + request logs).
- Env var strategy documented and `.env.example` present.
- Light/dark mode toggle in web + tenant theme token plumbing (stubbed).

---

## Milestone 2 - Users / Tenants / Auth Foundation ✅

Definition of done:

- Users, tenants, memberships.
- Auth baseline (email/password).
- Active tenant context (path + header + membership checks).
- Basic tenant switching UX (select active tenant).

UX expectations:

- After login/register, redirect to the first active tenant `/t/:tenantSlug`.
- Unauthenticated access to `/t/:tenantSlug` redirects to `/login`.

Notes:

- Social login (Google, Facebook/Meta) is LATER. Phase 1 auth must not depend on it.
- Local seed creates a platform admin + default tenant for dev convenience.

---

## Milestone 3 - Roles / Permissions / Product + SKU ✅

Definition of done:

- Tenant roles (OWNER, ADMIN, MEMBER, VIEWER).
- Permission-based access control (PBAC): roles define default permissions, permissions can be overridden.
- Permission guards on tenant routes.
- Platform admin (Super Admin) separation.
- Platform-managed categories.
- Product + SKU CRUD (SKU unique per tenant).
- `costCents` field on SKU (required for profit tracking).
- `barcode` field on SKU (optional, stored but not used until Phase 6).
- Light inventory fields only (`stockOnHand` on SKU).

---

## Milestone 4 - Inventory Movement

Definition of done:

- `InventoryMovement` table created and migrated.
- Movement types: `IN`, `OUT`, `ADJUSTMENT`.
- Reference types: `ORDER`, `MANUAL`.
- Every stock change is recorded as a movement — direct `stockOnHand` mutation is prohibited.
- `stockOnHand` on SKU is derived/updated via movement logging (backend enforced).
- API endpoints: log movement, list movements per SKU (tenant-scoped).
- Tenant-scoped: all queries filter by `tenantId`.
- Seed data: realistic movements for 3 business types (hardware, food/beverage, retail).
- Docs updated: `DATA_MODEL.md`.

---

## Milestone 5 - Orders

Definition of done:

- `Order` and `OrderItem` tables created and migrated.
- Order statuses: `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`.
- Create order flow: validates SKU availability, creates order + order items.
- Order items capture `priceAtTime` (snapshot of SKU price at order creation).
- Inventory movement logged automatically on order confirmation (`OUT` type, reference `ORDER`).
- API endpoints: create order, list orders, get order by ID, update order status (tenant-scoped).
- Tenant-scoped: all queries filter by `tenantId`.
- Audit log event: `order.created`, `order.status_changed`.
- Docs updated: `DATA_MODEL.md`.

---

## Milestone 6 - Payments (Manual Verification)

Definition of done:

- `Payment` table created and migrated.
- Payment statuses: `PENDING`, `VERIFIED`, `REJECTED`.
- Proof of payment: `proofUrl` field (image upload URL, stored as string).
- Manual verification flow: staff marks payment as VERIFIED or REJECTED.
- Payment linked to an Order (`orderId`).
- API endpoints: submit payment, list payments, verify/reject payment (tenant-scoped).
- Tenant-scoped: all queries filter by `tenantId`.
- Audit log events: `payment.submitted`, `payment.verified`, `payment.rejected`.
- No payment gateway integration. Manual only.
- Docs updated: `DATA_MODEL.md`.

---

## Milestone 7 - Feature Flags + Super Admin Controls

Definition of done:

- `features` JSONB field added to `Tenant` model.
- Feature flags: `inventory`, `orders`, `payments`, `marketplace` (marketplace stored but UI not built).
- `businessType` field added to `Tenant` model (preset only — values: `general_retail`, `hardware`, `food_beverage`, `packaging_supply`).
- Super Admin can enable/disable feature flags per tenant via API.
- Feature flag guards on relevant routes (inventory, orders, payments endpoints check flags).
- Super Admin dashboard: basic tenant list + feature flag toggle UI.
- `businessType` used only for setting defaults on tenant creation — not used in logic.
- Docs updated: `ARCHITECTURE.md`, `RULES.md`.

---

## Milestone 8 - Hardening + Seed + QA + Staging/Prod Prep

Definition of done:

- Seed data expanded: 3 realistic businesses (hardware store, food supplier, retail shop) with products, SKUs, inventory, orders, payments.
- Tenant isolation audit: run `/tenant-audit` and resolve all violations.
- QA checklist completed.
- Staging/prod readiness: env checklist, Vercel + Render + Neon Postgres deployment verified.
- All docs reflect final state.

Deferred UX items to resolve in this milestone:

- Root `/` page: currently a dev convenience landing page (tenant picker + login/register links). Replace with a proper entry point or redirect to `/login`.
- Tenant route guard: `/t/[tenantSlug]` renders the UI shell even for users without membership in that tenant — shows API 403 instead of redirecting. Add page-level membership check that redirects to the user's own tenant or `/login`.

---

## Post-MVP: UI/UX Polish (after MS8)

To be scoped after MS8 is complete. Do NOT implement during MS1–MS8.

- Replace dev-panel UI with a proper application shell: sidebar navigation, top header, breadcrumbs
- Data tables with sorting, filtering, and pagination for orders, SKUs, inventory movements
- Modals for create/edit flows (orders, SKUs, products)
- Tabs for switching between related views (e.g. Products / SKUs / Movements)
- Status badges, action menus, confirmation dialogs
- Toast/alert system already in place — wire it consistently across all panels
- Mobile-responsive layout

**Why deferred:** MS5–MS8 panels are scaffolding to verify API correctness. The final UI shape depends on knowing all module data and flows, which isn't finalized until MS8.

---

## Future Phases (DO NOT IMPLEMENT)

| Phase | Scope |
|---|---|
| Phase 5 | Mobile app (React Native / Expo) — staff-focused, offline-first |
| Phase 6 | POS + Barcode scanning (mobile-based, uses Orders + Payments) |
| Phase 7 | Marketplace — customer-facing UI, multi-tenant selling |
| Phase 8 | AWS scaling — ECS, RDS, S3, CloudFront, subdomain routing |

If a feature belongs to Phase 5+, do NOT implement. Document it and assign to the appropriate future phase.
