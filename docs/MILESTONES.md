# Platform Roadmap

> Last updated: 2026-03-30 — Full table restructure. Gaps & Risks analysis added. /audit added to PR workflow. Tenant self-registration removed (Calendly model). Multi-branch + marketing pulled into pre-staging. Username scoping fix added to MS9.

---

## Phase Map

| Phase | Milestones | Theme | Status |
|-------|-----------|-------|--------|
| **Phase 1** | MS1–MS2 | Foundation — Auth, Tenants, Users | ✅ Done |
| **Phase 2** | MS3 | Catalog — Products, SKUs, Categories | ✅ Done |
| **Phase 3** | MS4–MS6 | Operations — Inventory, Orders, Payments | ✅ Done |
| **Phase 4** | MS7–MS8 | Hardening — Admin, UI Overhaul, Prod Prep | ✅ Done |
| **Phase 5** | MS9–MS10 | Extensions — CSV Import, Team Mgmt, Multi-Branch | 🚧 MS9 in progress |
| **Phase 6** | MS11 | Go-to-Market — Marketing Website | 🚧 Pulled forward (before staging) |
| **Phase 7** | — | Marketplace — Customer Storefront | 🔒 Do not build yet |
| **Phase 8** | — | Mobile + POS | 🚫 Prohibited |
| **Phase 9** | — | AWS Scale + Subdomain Routing | 🔒 Do not build yet |

**Rules:**
- MVP = Phase 1–4 (MS1–MS8). First shippable product. ✅ Complete.
- 🔒 = architecturally designed, not yet scheduled.
- 🚫 = prohibited until explicit product decision.
- Never pull work from a future phase into a current milestone.

---

## Pre-Staging Checklist

> Must complete — in this order — before any real client touches the product.

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | MS9 close — username scoping, password change, negative stock floor, customerRef | 🚧 In progress | |
| 2 | Marketing page (`apps/marketing`) | 📋 Next | CTA = "Book a Demo" → Calendly. No self-registration. |
| 3 | Multi-branch v1 | 📋 Planned | Scaffolded, invisible at single-branch. No UI until 2nd branch added. |
| 4 | Dashboard / home screen | 📋 Planned | Summary of orders, payments, low stock on login. |
| 5 | Basic reports (orders CSV export, date filter) | 📋 Planned | Day-one client ask. |
| 6 | Staging deployment | 📋 Planned | Vercel (web + marketing) + Render (API) + Neon (DB) |

> **No tenant self-registration.** All tenants manually provisioned by Super Admin. Prospects book via Calendly → demo → owner creates their tenant. Self-serve signup only unlocks when a pricing model is defined.

---

## Gaps & Risks Analysis

> Run `/audit` before every PR. This table tracks known issues across the full platform.

### 🔴 Blocking — fix before staging

| # | Issue | Status | Fix |
|---|-------|--------|-----|
| 1 | Staff can't change their password | ⏳ MS9 | Add `PATCH /auth/me/password` + settings UI |
| 2 | Username collision across tenants | ⏳ MS9 | `username` on `TenantMembership`, not `User.email`. Scoped `@@unique([tenantId, username])` |
| 3 | No customer reference on orders | ⏳ MS9 | Add nullable `customerRef String?` to `Order` |
| 4 | No dashboard / home screen | ⏳ Pre-staging | Summary view: orders today, pending payments, low stock |
| 5 | No marketing page / demo CTA | ⏳ MS11 | `apps/marketing`, static Next.js, Calendly link |

### 🟡 Warning — fix before staging

| # | Issue | Status | Fix |
|---|-------|--------|-----|
| 6 | Stock goes negative on manual OUT movements | ⏳ MS9 | Add stock floor check in `InventoryService` for manual adjustments |
| 7 | No basic reports or exports | ⏳ Pre-staging | CSV export on orders, date range filter |
| 8 | 7-day JWT — deactivating User (not membership) doesn't revoke access | ❌ Open | Low risk now. TenantGuard checks membership. Revisit at staging. |
| 9 | SMTP unconfigured locally — invites silently dropped | ❌ Open | Add Mailhog to local dev setup docs + `.env` warning |
| 10 | No profile page for non-owner staff | ❌ Open | Minor. Add avatar/name edit to user menu for all roles. |

### 🟢 Advisory — log and revisit

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 11 | Currency hardcoded to ₱ in `formatCents()` | ❌ Open | Fine for PH-only. Becomes a problem for international demos. |
| 12 | CSV import allows wrong `categorySlug` per tenant type | ❌ Open | UX issue. Pizza shop can import with `fasteners` category. Not a security risk. |
| 13 | Direct-add staff have no email → can't use Forgot Password | ❌ Open | Resolved by password change endpoint (item 1). |
| 14 | No pricing / tiers | ✅ Intentional | Calendly model. Revisit post-staging with real client feedback. |
| 15 | Tenant self-registration | ✅ Intentional | Super Admin provisions manually. By design. |

### ✅ Fixed This Milestone

| # | Issue | Fixed in |
|---|-------|----------|
| 16 | Team list showing 0 members | MS9 — `JwtAuthGuard` missing on `GET /memberships/team` |
| 17 | Invite link pointed to API port (3001) | MS9 — `APP_FRONTEND_URL` env var |
| 18 | Login rejected phone/nickname identifiers | MS9 — `@IsEmail()` replaced with `@IsString()` on `LoginDto` |
| 19 | Invite emails linked to wrong port | MS9 — `appFrontendUrl` used in memberships service |

---

## PHASE 1 — Foundation ✅

### MS1 — Repo & Infrastructure ✅

| Feature | Status |
|---------|--------|
| Repo scaffold: `apps/api`, `apps/web`, `packages/db`, `infra/` | ✅ |
| Local Postgres via Docker Compose | ✅ |
| Prisma wired, first migration runs | ✅ |
| `GET /health` works | ✅ |
| Web boots, calls API health | ✅ |
| Structured logging (request ID + request logs) | ✅ |
| Env var strategy documented, `.env.example` present | ✅ |
| Light/dark mode toggle + tenant theme token plumbing (stubbed) | ✅ |

### MS2 — Users / Tenants / Auth ✅

| Feature | Status |
|---------|--------|
| Users, tenants, memberships | ✅ |
| Auth baseline (email/password, bcrypt) | ✅ |
| Active tenant context (path + header + membership checks) | ✅ |
| Roles: OWNER, ADMIN, STAFF, VIEWER | ✅ |
| PBAC scaffolding: `can_*` permission flags per membership | ✅ |
| JWT issued on login, validated on all protected routes | ✅ |
| `GET /auth/me` returns current user | ✅ |
| Seed: 1 admin user, 1 admin tenant | ✅ |
| Docs: `ARCHITECTURE.md`, `DATA_MODEL.md` written | ✅ |

---

## PHASE 2 — Catalog ✅

### MS3 — Products, SKUs, Categories ✅

| Feature | Status |
|---------|--------|
| `Category` (platform-owned, no tenantId) | ✅ |
| `Product` (tenant-owned: name, categoryId, isActive) | ✅ |
| `Sku` (tenant-owned: code, name, priceCents, costCents, stockOnHand, lowStockThreshold) | ✅ |
| CRUD for products and SKUs via REST API | ✅ |
| Tenant isolation enforced at service layer | ✅ |
| Seed: realistic products + SKUs for 3 demo tenants | ✅ |

---

## PHASE 3 — Operations ✅

### MS4 — Inventory ✅

| Feature | Status |
|---------|--------|
| `InventoryMovement` (IN / OUT / ADJUSTMENT, referenceType: ORDER / MANUAL) | ✅ |
| `stockOnHand` on `Sku` — only mutated via movement, never directly | ✅ |
| `GET /inventory/movements` — paginated list per tenant | ✅ |
| `POST /inventory/movements` — manual adjustment (ADMIN+ only) | ✅ |
| Inventory panel UI | ✅ |

### MS5 — Orders ✅

| Feature | Status |
|---------|--------|
| `Order` (PENDING → CONFIRMED → COMPLETED \| CANCELLED) | ✅ |
| `OrderItem` (skuId, quantity, priceAtTime — captured at creation, never updated) | ✅ |
| Editing an order: replaces all items, recalculates total, PENDING only | ✅ |
| Confirming: deducts stock via OUT movement | ✅ |
| Cancelling CONFIRMED: restores stock via IN movement | ✅ |
| Negative stock prevention on order confirmation | ✅ |
| Pagination: `GET /orders?page&limit` → `{ data, meta }` | ✅ |
| Orders panel UI with right-side detail Sheet | ✅ |

### MS6 — Payments ✅

| Feature | Status |
|---------|--------|
| `Payment` (PENDING → VERIFIED \| REJECTED) | ✅ |
| Manual proof-of-payment upload (proofUrl) | ✅ |
| Verify / Reject by ADMIN+ | ✅ |
| Pagination: `GET /payments?page&limit` | ✅ |
| Payments panel UI with Payables + History tabs | ✅ |

---

## PHASE 4 — Hardening + Admin ✅

### MS7 — Feature Flags + Super Admin ✅

| Feature | Status |
|---------|--------|
| `Tenant.features` JSONB: `inventory`, `orders`, `payments`, `marketplace` | ✅ |
| Super Admin role (`isPlatformAdmin: true` on User) | ✅ |
| Super Admin dashboard: tenant list, feature flag toggle, user management | ✅ |
| `POST /admin/tenants` — Super Admin creates tenants | ✅ |
| `PATCH /admin/tenants/:id/features` — toggle flags | ✅ |
| `PATCH /admin/tenants/:id/status` — suspend / reactivate | ✅ |
| `PATCH /admin/users/:id` — promote / demote Super Admin | ✅ |
| Feature-flagged sidebar items | ✅ |

### MS8 — Hardening + UI Overhaul + Prod Prep ✅

| Feature | Status |
|---------|--------|
| **Security** | |
| Password reset flow (`/forgot-password`, `/reset-password`) | ✅ |
| Rate limiting (`@nestjs/throttler`) on auth endpoints | ✅ |
| Security headers (Helmet) | ✅ |
| CORS: `CORS_ALLOWED_ORIGINS` env var | ✅ |
| Negative stock prevention on order confirmation | ✅ |
| Order cancellation restores inventory | ✅ |
| JWT expiry: `JWT_EXPIRES_IN_SECONDS` (default 7 days) | ✅ |
| **Image Upload** | |
| `POST /uploads` — Multer, 5MB limit, image types only | ✅ |
| Local storage: `uploads/`, served via `express.static` | ✅ |
| S3 storage: switchable via `STORAGE_TYPE=s3` | ✅ |
| SKU image upload in CatalogPanel | ✅ |
| Tenant logo: `PATCH /tenant/logo` (OWNER/ADMIN) | ✅ |
| User avatar: `PATCH /auth/me` | ✅ |
| **Notifications** | |
| `Notification` model: tenant + user scoped | ✅ |
| `notifyTenant()` helper | ✅ |
| Triggers: ORDER_*, PAYMENT_* events | ✅ |
| Bell UI: popover, unread badge, mark read, polls every 8s | ✅ |
| **UI Overhaul** | |
| Split-screen auth layout (`AuthLayout`) | ✅ |
| Login, Register, ForgotPassword, ResetPassword, AcceptInvite pages | ✅ |
| Sidebar: feature-flagged nav, tenant logo, collapse toggle | ✅ |
| Header: breadcrumbs, tenant switcher, notification bell, user menu | ✅ |
| Orders panel: multi-item, edit flow, Sheet detail | ✅ |
| Payments panel: Payables / History tabs | ✅ |
| Catalog panel: archive buttons, SKU image upload | ✅ |
| Settings: Tenant Profile (logo upload) | ✅ |
| **QA** | |
| Seed data: 67 orders / 44 payments / 24 SKUs across 3 tenants | ✅ |
| E2E tests: 107/107 passing | ✅ |
| Tenant isolation audit completed | ✅ |

---

## PHASE 5 — Extensions 🚧

### MS9 — CSV Import + Team Management 🚧

#### CSV Import

| Feature | Status | Notes |
|---------|--------|-------|
| `POST /catalog/import` — multipart CSV, TenantGuard | ✅ | |
| Supported columns incl. snake_case aliases | ✅ | `pricePhp`, `costPhp` auto-converted to cents |
| Row-level validation: missing fields, duplicate codes, unknown category | ✅ | |
| Idempotent upsert by `(tenantId, skuCode)` | ✅ | |
| Response: `{ imported, updated, skipped, errors[] }` | ✅ | |
| E2E tests: 7 cases including tenant isolation | ✅ | |
| Drag-drop upload zone in Catalog panel | ✅ | |
| Download template button | ✅ | |
| Post-import result: counts + per-row error list | ✅ | |
| Preview table (first 10 rows before confirming) | ⏳ Deferred | Slot reserved in UI. Post-MS10. |
| Column mapping UI | ⏳ Deferred | Exact headers required; snake_case aliases reduce friction |

#### Team Management

| Feature | Status | Notes |
|---------|--------|-------|
| `GET /memberships/team` — all statuses (ACTIVE, INVITED, DISABLED) | ✅ | Fixed missing JwtAuthGuard |
| `POST /memberships/invite` — email invite, 48h token | ✅ | Links to `APP_FRONTEND_URL` |
| `POST /memberships/add-direct` — no-email staff, any identifier | ✅ | Account immediately ACTIVE |
| `PATCH /memberships/:id` — role, job title, deactivate, reactivate | ✅ | |
| `jobTitle` on `TenantMembership` | ✅ | Informational only |
| Member list with status filter (All / Active / Pending / Deactivated) | ✅ | |
| Edit button → modal (role + job title) | ✅ | OWNER/ADMIN only |
| Deactivate / Cancel invite / Reactivate buttons per row | ✅ | |
| Add member dialog: Invite by email / Add directly toggle | ✅ | |

#### MS9 — Remaining (In Progress)

| Feature | Status | Notes |
|---------|--------|-------|
| Username scoping — `username` on `TenantMembership`, not `User.email` | 🔴 Not started | Prevents collision: two "juan" at different tenants. Login adds optional "Business code" field. |
| Staff password change (`PATCH /auth/me/password`) | 🔴 Not started | Direct-add staff have no email → can't use Forgot Password |
| Negative stock floor on manual OUT movements | 🔴 Not started | Manual adjustments bypass the check that order confirmation enforces |
| `customerRef` on orders | 🔴 Not started | B2B dealbreaker: who placed the order? |

### MS10 — Multi-Branch Support 📋

> **Deploy strategy:** Multi-branch v1 ships **before staging** as a scaffolded invisible feature. Single-branch tenants see zero UI change. Branch switcher appears only when a tenant has >1 branch.

#### Context

| Business | Type | Multi-branch need |
|----------|------|-------------------|
| Manager's Pizza (tenant 1) | Food wholesale + retail | Central kitchen + outlets |
| Megabox (tenant 2) | Pizza equipment supplier | Warehouse + retail counter |

> These are two separate **tenants** (already solved). Multi-branch = locations *within* each tenant.

#### Design Decisions

| Decision | Answer |
|----------|--------|
| Stock pools | Independent per branch |
| Catalog (products/SKUs) | Shared across tenant |
| Orders | Branch-scoped (fulfilled from a specific branch) |
| Inventory movements | Branch-scoped |
| Payments | Tenant-wide (tied to orders) |
| Staff assignment | Optional branch restriction (empty = all branches) |
| "All Branches" view | Aggregated totals for Owner/Admin |
| Single-branch behavior | Branch switcher hidden; all queries use default branch implicitly |

#### Data Model Changes

| Change | Notes |
|--------|-------|
| `Branch` table: `id`, `tenantId`, `name`, `address`, `isDefault`, `status` | Auto-created on tenant creation |
| `InventoryMovement.branchId` FK (nullable) | Nullable for historical data |
| `Order.branchId` FK (nullable) | Nullable for historical data |
| `TenantMembership.branchIds` JSON array | Empty = access to all branches |
| `Sku.stockOnHand` | Stays as tenant-wide total. Per-branch via movement aggregation. `BranchInventory` table in full MS10. |

#### API Additions

| Endpoint | Guard | Notes |
|----------|-------|-------|
| `GET /branches` | TenantGuard | List branches for tenant |
| `POST /branches` | TenantGuard (OWNER/ADMIN) | Create branch |
| `PATCH /branches/:id` | TenantGuard (OWNER/ADMIN) | Update name, address, status |
| `x-branch-id` header | Optional | If omitted → tenant-wide aggregated scope |

#### UI Changes

| Component | Change |
|-----------|--------|
| Sidebar / header | Branch switcher (hidden when 1 branch) |
| All panels | Filter by active branch or show aggregated |
| Settings | Branches tab: list, create, edit, deactivate |
| Team members | Branch assignment per member |

---

## PHASE 6 — Go-to-Market 🚧 (Pulled forward — before staging)

### MS11 — Marketing Website

| Feature | Status | Notes |
|---------|--------|-------|
| `apps/marketing` — standalone Next.js static app | 📋 Planned | Fully independent of platform |
| Hero section: headline, subheadline, CTA | 📋 Planned | CTA = "Book a Demo" → Calendly |
| Features grid (config-driven via `features.config.ts`) | 📋 Planned | Add/remove cards without code changes |
| How-it-works walkthrough | 📋 Planned | add products → stock → order → payment |
| Social proof section | 📋 Planned | Placeholder until real client logos |
| Footer with links | 📋 Planned | |
| Fully static (`next export`) — no server runtime | 📋 Planned | |
| **No pricing page** | ✅ Decided | No tiers yet. "Contact us" only. |
| **No "Get Started" self-signup** | ✅ Decided | Super Admin provisions manually. |

---

## PHASE 7 — Marketplace 🔒

> Do not build yet. Unlocks after Phase 4 is stable and validated demand exists.

| Component | Description |
|-----------|-------------|
| Global marketplace (`/marketplace`) | Customers browse across all tenants |
| Per-tenant storefront (`/shop/:tenantSlug`) | Scoped to one seller |
| `MarketplaceListing` model | Links SKU to marketplace with optional separate `marketplacePrice` |
| Customer auth | Separate from staff auth. `CustomerProfile` ≠ `TenantMembership` |
| Multi-tenant cart | Splits into separate orders per tenant at checkout |
| Inventory reservation | `reservedQty` on listing, 30-min TTL |
| Payment gateway | Stripe / PayMongo — NOT manual proof upload |
| Feature flag | `marketplace: true` per tenant, controlled by Super Admin |

---

## PHASE 8 — Mobile + POS 🚫

> Prohibited. Requires dedicated mobile engineers and hardware integrations.

| Item | Status |
|------|--------|
| Mobile app (React Native / Expo) | 🚫 Do not implement |
| POS + barcode scanning | 🚫 Do not implement |

---

## PHASE 9 — AWS Scale 🔒

> Do not build until traffic demands it.

| Item | Description |
|------|-------------|
| ECS / EKS | Container orchestration |
| RDS (Postgres) | Replacing Neon, with read replicas |
| S3 + CloudFront | Static assets + uploads |
| Subdomain routing | `acme.yourplatform.com` per tenant |
| PgBouncer / Prisma Accelerate | Connection pooling |

---

## Feature Backlog

> Designed and ready to scope. Not phase-assigned. Do not implement speculatively.

| Feature | Priority | Phase | Prerequisite | Why Deferred |
|---------|----------|-------|-------------|--------------|
| Reports / CSV export (orders, payments) | 🔴 High | Pre-staging | MS9 done | Day-one client ask — "how much did we sell this month?" |
| `customerRef` + `note` on orders | 🔴 High | MS9 | — | Moved up — B2B dealbreaker |
| Low Stock Threshold + Alerts | 🟡 Medium | Post-Phase 4 | External notifications | `lowStockThreshold` exists on SKU. Needs notification channel. |
| External Notification Delivery | 🟡 Medium | Post-Phase 4 | MS8 notifications | Email first, then Messenger, WhatsApp, SMS. BullMQ queue. |
| Queryable Audit Log | 🟡 Medium | Post-Phase 4 | — | "Who changed this order?" High value for enterprise. |
| OAuth / Social Login | 🟢 Low | Post-Phase 4 | — | Email/password sufficient. Requires app registration. |
| i18n + Currency settings | 🟢 Low | Post-Phase 4 | Stable UI | ₱ hardcoded now. Add `Tenant.locale` + `Tenant.currency`. |
| Custom Roles | 🟢 Low | Post-Phase 4 | — | OWNER/ADMIN/STAFF/VIEWER covers 90% of use cases. |
| Super Admin Impersonation | 🟢 Low | Post-Phase 4 | Audit Log | Support/debug tool. Requires full audit trail first. |
| Payroll Module | 🔒 Locked | Post-Phase 5 | Multi-Branch | Regulated domain. Validate demand before committing. |
| Platform Integrations (Shopee, Lazada) | 🔒 Locked | Post-Phase 5 | Stable core | Webhook security, retry logic, idempotency add complexity. |
| AI Chatbot + RAG | 🔒 Locked | Post-Phase 5 | Real tenant data | Claude API + pgvector. Feature-flagged per tenant. |

---

## Known Engineering Challenges

| Challenge | Impact | Mitigation |
|-----------|--------|------------|
| **Permission drift** | Staff accumulate custom overrides; role changes may conflict | Add "reset to role default" action in PBAC UI |
| **Privilege escalation** | ADMIN must not grant permissions exceeding their own ceiling | Guards validate acting user's scope, not just target role |
| **JWT token lag** | Permission changes take effect at next login (7-day JWT) | Check `membership.status` on every protected request |
| **Concurrent order confirmation race** | Two simultaneous CONFIRM requests both pass stock check | Mitigated by `$transaction` wrapping stock check + decrement |
| **Username collision (pre-fix)** | Two "juan" at different tenants crash | Fix: `username` on `TenantMembership` with `@@unique([tenantId, username])` |
| **Low stock alert spam** | Stock hovering at threshold fires on every OUT movement | Cooldown per SKU (`lastAlertedAt`) — max one alert per 6h |
| **Messenger / WhatsApp template constraint** | Meta only allows free-form within 24h reply window | Register message templates before launch |
| **Render cold starts** | Free tier spins down after ~15min idle — 10–30s first request | Document for testing; upgrade to Render Starter before real users |
| **Neon connection exhaustion** | Prisma opens connection per request; free tier has low ceiling | Add PgBouncer or Prisma Accelerate before production load |
| **Branch migration risk** | MS10 changes `stockOnHand` semantics (per-branch vs total) | Plan migration carefully; existing data → default branch. Test on staging first. |
| **Integration webhook security** | External platforms must authenticate webhook payloads | Verify HMAC signatures on all incoming requests |
