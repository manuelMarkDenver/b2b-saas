# Platform Roadmap

> Last updated: 2026-04-02 — MS19g: unified Create Item flow (shared modal, auto-SKU with override, single endpoint). MS19f: feature flags (stockTransfers/paymentTerms), customer in orders, CSV import modal, catalog UI fixes. MS19e: branch stock. MS19d: partial payments, BranchType. MS17: payment method. Product strategy: Ascendex vs MGN, PayMongo.

---

## Phase Map

| Phase | Milestones | Theme | Status |
|-------|-----------|-------|--------|
| **Phase 1** | MS1–MS2 | Foundation — Auth, Tenants, Users | ✅ Done |
| **Phase 2** | MS3 | Catalog — Products, SKUs, Categories | ✅ Done |
| **Phase 3** | MS4–MS6 | Operations — Inventory, Orders, Payments | ✅ Done |
| **Phase 4** | MS7–MS8 | Hardening — Admin, UI Overhaul, Prod Prep | ✅ Done |
| **Phase 5** | MS9–MS10 | Extensions — CSV Import, Team Mgmt, Multi-Branch | ✅ Done |
| **Phase 6** | MS11 | Go-to-Market — Marketing Website | ✅ Done |
| **Phase 7** | — | Marketplace — Customer Storefront | 🔒 Do not build yet |
| **Phase 8** | — | Mobile + POS | 📋 PWA pre-staging; native app after revenue |
| **Phase 9** | — | AWS Scale + Subdomain Routing | 🔒 Do not build yet |

**Rules:**
- MVP = Phase 1–4 (MS1–MS8). First shippable product. ✅ Complete.
- 🔒 = architecturally designed, not yet scheduled.
- Never pull work from a future phase into a current milestone.

**On mobile:** PWA + responsive web ships **second-to-last before staging** — after all functionality is stabilised and MVP market-fit is confirmed. Doing it earlier means re-doing responsive work every time a panel changes. React Native native app (Phase 8) ships only after real revenue validates the investment. See "Mobile Strategy" in the Pre-Staging Checklist section for the full rationale.

---

## Pre-Staging Checklist

> Must complete — in this order — before any real client touches the product.

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | MS9 — username scoping, password change, negative stock floor, customerRef | ✅ Done | Merged |
| 2 | Marketing page (`apps/marketing`) | ✅ Done | MS11 merged |
| 3 | Multi-branch v1 (MS10) | ✅ Done | Merged |
| 4 | Dashboard / home screen (MS12) | ✅ Done | Summary cards, date range (presets + custom), 4 Recharts: area revenue, bar orders/day, donut status, horizontal bar low stock. |
| 5 | Basic reports (orders CSV export, date filter) | ✅ Done | MS13 — GET /reports/orders + CSV export, sidebar nav, date picker. |
| 6 | **Mobile responsive + PWA** | ✅ Done | MS14 — manifest, service worker, mobile drawer, horizontal-scroll tables, responsive sheets. |
| 7 | MS16 — UI/UX overhaul (inventory, filters, stock approvals, reports, dashboard widgets) | ✅ Done | Branch `milestone-16/ui-ux-overhaul` — 11 phases |
| 8 | Partial payments (MS19) | ✅ Done | `POST /orders/:id/pay`, overpayment guard, paid/balance computed, UI shows payment history |
| 9 | BranchType UI (MS19c) | ✅ Done | BranchType enum in schema, badge in page header + branch switcher |
| 10 | Branch stock transfer fix (MS19e) | ✅ Done | Derived branch stock from movements, transfer updates tenant-wide stock |
| 11 | Feature flags + Catalog UI fixes (MS19f) | ✅ Done | stockTransfers/paymentTerms in Super Admin, CSV import modal, catalog width, edit sheet with 100% image |
| 12 | Unified Create Item flow (MS19g) | ✅ Done | Single modal for Product+SKU creation, auto-SKU with override toggle, shared component across Products and Inventory tabs, backend `code` and `lowStockThreshold` support in `/products/with-stock` |
| 13 | Staging deployment | 📋 Next | Vercel (web + marketing) + Render (API) + Neon (DB) |

> **No tenant self-registration.** All tenants manually provisioned by Super Admin. Prospects book via Calendly → demo → owner creates their tenant. Self-serve signup only unlocks when a pricing model is defined.

### Single-Branch vs Multi-Branch Visibility Rules

All branch-aware UI is **hidden by default** and only appears when a tenant has more than 1 active branch. This ensures single-branch tenants see a clean, simple interface with no multi-branch concepts surfaced.

| UI Element | Single branch | Multi-branch |
|-----------|:---:|:---:|
| Branch switcher in header | Hidden | Visible |
| "All branches" option in switcher | — | Always shown (resets to tenant-wide scope) |
| Default branch auto-selected on load | No — starts at "All branches" | No — starts at "All branches" |
| Branch breakdown table on dashboard | Hidden | Visible |
| Accordion collapse on breakdown table | — | Shown when >5 branches |
| Search bar in branch switcher | — | Shown when >7 branches |
| "Viewing: 1 branch / show all" text on dashboard | Hidden | Visible when a branch is drilled into |
| Branch column in order/payment tables | Hidden | Future (post-MVP) |

**Scope of branch filter:**
- Global branch switcher (header) → scopes ALL tabs: Orders, Payments, Inventory
- Dashboard inline branch selector → scopes only dashboard cards and charts, does not affect other tabs
- "All branches" = no `x-branch-id` header sent → API returns full tenant-wide data

### Mobile Strategy — Why PWA, Not Native App

**The problem (valid):** The Philippine SMB market is mobile-first. Most business owners and staff operate from Android phones. A desktop-only app will have friction at every demo and daily use.

**The solution: PWA + responsive web — not React Native.**

| Approach | Timeline | Cost | Ships features instantly | Same codebase |
|----------|----------|------|------------------------|---------------|
| React Native app | +3–6 months | High | ❌ | ❌ |
| PWA + responsive | +2–3 weeks | Near zero | ✅ | ✅ |

A PWA installed on Android/iOS home screen is indistinguishable from a native app for the target use cases (create orders, check stock, log payments at counter). Native app (Phase 8) only makes sense after real revenue and validated demand for it.

**Role → device mapping:**
| Role | Likely device | Primary actions |
|------|--------------|----------------|
| Owner / Admin | Phone or desktop | Reports, settings, team |
| Staff / Cashier | Phone at counter | Create orders, log payments |
| Warehouse staff | Phone on floor | Log movements, check stock |

---

## Gaps & Risks Analysis

> Run `/audit` before every PR. This table tracks known issues across the full platform.

### 🔴 Blocking — fix before staging

| # | Issue | Status | Fix |
|---|-------|--------|-----|
| 1 | Staff can't change their password | ✅ MS9 | `PATCH /auth/me/password` + settings UI card |
| 2 | Username collision across tenants | ✅ MS9 | `username` on `TenantMembership`, scoped `@@unique([tenantId, username])` |
| 3 | No customer reference on orders | ✅ MS9 | `customerRef String?` + `note String?` on `Order` |
| 4 | No dashboard / home screen | ✅ MS12 | Summary cards, date range (presets + custom), 4 animated Recharts (area, bar, donut, horizontal bar) |
| 5 | No marketing page / demo CTA | ✅ MS11 | `apps/marketing`, static Next.js, Calendly link |

### 🟡 Warning — fix before staging

| # | Issue | Status | Fix |
|---|-------|--------|-----|
| 6 | Stock goes negative on manual ADJUSTMENT | ✅ MS9 | Stock floor check added in `InventoryService` for negative adjustments |
| 7 | ₱ hardcoded in `payments.service.ts` notification body | ✅ Done | `payments.service.ts` — uses `toLocaleString('en-PH', { style: 'currency' })` |
| 8 | Duplicate `formatCents()` in `orders-panel.tsx` + `payments-panel.tsx`, both hardcode ₱ | ✅ Done | Extracted to `apps/web/src/lib/format.ts`; 4 local copies removed |
| 9 | Missing `@@index([status])` on `Order`, `Payment`, `TenantMembership`; missing `@@index([createdAt])` on `Order` | ✅ Done | Migration `20260330135249_add_status_createdat_indexes` |
| 10 | No basic reports or exports | ✅ MS13 | CSV export on orders, date range filter |
| 11 | 7-day JWT — deactivating User (not membership) doesn't revoke access immediately | ❌ Open | Low risk now. TenantGuard checks membership status. Revisit at staging. |
| 12 | SMTP unconfigured locally — invites silently dropped | ❌ Open | Add Mailhog to local dev setup docs + `.env` warning |
| 27 | `uploads` controller missing `TenantGuard` | ❌ Open | `uploads.controller.ts:23` — any authenticated user can upload regardless of tenant. Add `TenantGuard` and scope files under `tenantId/`. |
| 28 | Hardcoded tenant slugs in `tenant-theme.ts` | ❌ Open | `tenant-theme.ts:46,62` — `peak-hardware` and `corner-general` baked into frontend theming. Move to a `theme` JSON column on `Tenant` before real clients onboard. |
| 33 | No partial payments / AR tracking | ✅ MS19 | `POST /orders/:id/pay`, computed balance, payment history UI |
| 34 | Stock transfer doesn't update stockOnHand | ✅ MS19e | Transfer OUT/IN now updates tenant-wide stock; branch stock derived from movements |

### 🟢 Advisory — log and revisit

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 13 | `UsersService.findById()` is dead code — exported, never called | ❌ Open | `users.service.ts:8`. Not a live leak. Remove to avoid confusion. |
| 14 | `Notification.tenantId` is nullable — not documented in schema | ❌ Open | Intentional for `PLATFORM_ALERT` type. Add inline comment to schema. |
| 15 | `OrderItem` has no `createdAt`/`updatedAt` | ❌ Open | Immutable by design (deleted+recreated on order edit). Timestamps would help audit trail. |
| 16 | Financial FK relations lack explicit `onDelete: Restrict` | ❌ Open | Currently relies on Postgres default. Make explicit before staging to prevent migration mistakes. |
| 17 | CSV import allows wrong `categorySlug` per business type | ❌ Open | UX issue. Pizza shop can import with `fasteners` category. Not a security risk. |
| 18 | No pricing / tiers | ✅ Intentional | Calendly model. Revisit post-staging with real client feedback. |
| 19 | Tenant self-registration | ✅ Intentional | Super Admin provisions manually. By design. |
| 29 | `GET /categories` has no auth guard | ❌ Open | `catalog.controller.ts:25` — categories are platform-owned public data, no tenant scope. Not sensitive, but inconsistent with rest of API. |
| 30 | `console.error` in bootstrap code | ❌ Open | `main.ts:59`, `env.validation.ts:39` — pino not available at startup so `console.error` is acceptable, but worth noting. |
| 31 | `localhost` fallback in `uploads.service.ts` | ❌ Open | `uploads.service.ts:43` — `?? 'http://localhost:3001'` safety net. `APP_BASE_URL` must be set in prod; env validation already enforces it. |
| 32 | `tenant.controller.ts` has no E2E spec | ❌ Open | `GET /tenant/context`, `PATCH /tenant/logo`, `GET /tenant/memberships` untested end-to-end. |

### ✅ Fixed This Milestone (MS9–MS12)

| # | Issue | Fixed in |
|---|-------|----------|
| 20 | Team list showing 0 members | MS9 — `JwtAuthGuard` missing on `GET /memberships/team` |
| 21 | Invite link pointed to API port (3001) | MS9 — `APP_FRONTEND_URL` env var |
| 22 | Login rejected phone/nickname identifiers | MS9 — `@IsEmail()` replaced with `@IsString()` on `LoginDto` |
| 23 | Direct-add staff have no email → can't use Forgot Password | MS9 — `PATCH /auth/me/password` endpoint + UI |
| 24 | Username collision across tenants (two Juans, different businesses) | MS9 — `membership.username` scoped per tenant |
| 25 | No multi-branch support | MS10 — `Branch` model, `BranchesModule`, `x-branch-id` header filtering, branch switcher UI |
| 26 | Dashboard was a stub with no real data | MS12 — `GET /dashboard` with date range, 4 animated charts (revenue area, orders bar, status donut, low stock horizontal bar) |

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
| `Tenant.features` JSONB: `inventory`, `orders`, `payments`, `marketplace`, `network` | ✅ (network flag designed; not yet in schema — add when Organization layer is built) |
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

### MS11 — Marketing Website 🚧 In Progress

> Full spec: `docs/milestones/ms11-marketing.md`
> Brand: **Operix** (placeholder). Target: Filipino-first, global-ready.
> Global ambition is intentional — currency + language features in the platform are the scaffold for it.

| Feature | Status | Notes |
|---------|--------|-------|
| `apps/marketing` — standalone Next.js static app | ✅ Built | `milestone-11/marketing-site` branch |
| Navbar (sticky, mobile responsive) | ✅ Built | |
| Hero — headline, subheadline, CTA | ✅ Built | Image slot ready for `/generate-image` |
| Social proof bar | ✅ Built | Logo placeholders until real clients go live |
| Features grid — dynamic from `features.config.ts` | ✅ Built | Only enabled features render |
| How-it-works — 3 steps with images | ✅ Built | Image slots ready |
| Demo section — animated UI + voice-over audio | ✅ Built | Audio slot ready for `/generate-voiceover` |
| Testimonial section | ✅ Built | Placeholder; swap in `marketing.config.ts` |
| Final CTA section | ✅ Built | |
| Footer | ✅ Built | |
| All copy in `marketing.config.ts` | ✅ Built | Single source of truth |
| All assets in `features.config.ts` | ✅ Built | Feature toggle = one boolean |
| Fully static (`next export`) | ✅ Built | Verified: `next build` passes |
| **No pricing page** | ✅ Decided | No tiers yet |
| **No self-signup** | ✅ Decided | Super Admin provisions manually |
| Hero image generated | ⏳ Pending | Needs `REPLICATE_API_TOKEN` or `OPENAI_API_KEY` |
| How-it-works images (×3) generated | ⏳ Pending | Needs token |
| Voice-over MP3 generated | ⏳ Pending | Needs `OPENAI_API_KEY` |
| Testimonial avatar generated | ⏳ Pending | Needs token |
| Real Calendly URL configured | ⏳ Pending | Set `urls.calendly` in `marketing.config.ts` |

---

### MS13 — Basic Reports ✅ Done

> Day-one client ask: "How much did we sell this month?"

| Feature | Status | Notes |
|---------|--------|-------|
| `GET /reports/orders` — date range filter | ✅ Done | Query params: `from`, `to` (ISO dates). |
| `GET /reports/orders?format=csv` | ✅ Done | Returns CSV with headers. |
| Branch filtering support | ✅ Done | Respects `x-branch-id` header. |
| Reports sidebar nav item | ✅ Done | Feature-gated, added to sidebar. |
| Reports page: date picker + table | ✅ Done | Reuse dashboard date presets. Default: This Month. |
| Export CSV button | ✅ Done | Browser blob download. |

**CSV columns:**
- Order ID
- Date
- Customer Ref
- Total (₱)
- Status
- Item Count
- Branch (if multi-branch)

**Date presets (reused from dashboard):**
- Today
- Yesterday
- Last 7 days
- This Month
- Last Month
- Custom range

---

### MS14 — PWA + Mobile Responsive ✅ Done

> Make the existing app installable as a PWA and usable on phone screens. Same features, same routes — just mobile-friendly layout.

| Feature | Status | Notes |
|---------|--------|-------|
| `manifest.json` + app icons | ✅ Done | `name`, `short_name`, `start_url`, 192×192 + 512×512 icons |
| Service worker via `@ducanh2912/next-pwa` | ✅ Done | Auto-generated; offline fallback page at `/offline` |
| Viewport meta + theme-color | ✅ Done | Fixes mobile viewport scaling |
| App title update | ✅ Done | "B2B Platform" replacing "Create Next App" |
| Mobile sidebar drawer | ✅ Done | Fixed overlay on mobile, inline collapse on desktop |
| Responsive tables (horizontal scroll) | ✅ Done | `overflow-x-auto` wrapper on orders, payments, inventory, reports panels |
| Responsive sheets | ✅ Done | `w-full sm:w-[680px/520px]` on all SheetContent panels |
| Settings layout responsive | ✅ Done | `flex-col md:flex-row` on settings sub-nav; horizontal pills on mobile |
| Header overflow fixed | ✅ Done | TenantSwitcher/BranchSwitcher/NotificationBell hidden on mobile; breadcrumb truncated |

---

### MS15 — Browser Tests (Playwright) ✅ Done

> Automated browser tests for key flows. No more manual UI testing.

| Suite | Status | File | What it covers |
|-------|--------|------|----------------|
| PWA smoke tests | ✅ Done | `e2e/pwa.spec.ts` | manifest.json, icons, offline page, viewport meta, title |
| Auth flow | ✅ Done | `e2e/auth.spec.ts` | Login renders, invalid creds show error, success redirects, already-authed redirect |
| Mobile responsive | ✅ Done | `e2e/mobile-responsive.spec.ts` | Sidebar hidden on mobile, hamburger toggles drawer, backdrop closes, table overflow, header height |
| Desktop layout | ✅ Done | `e2e/mobile-responsive.spec.ts` | Sidebar visible by default, toggle inline (no backdrop on desktop) |

**Run:**
```bash
# Start API + web dev servers first, then:
pnpm --filter web test:e2e            # headless (all suites)
pnpm --filter web test:e2e:ui         # interactive Playwright UI
pnpm --filter web test:e2e:report     # view last run HTML report
```

**Browsers:** Desktop Chrome + Pixel 5 (mobile Chrome)

---

### MS17 — Accounting Filters + Payment Method 🚧 In Progress

> Branch: `milestone-17/accounting-filters`
> Goal: Give operators and accountants the filter set they need for daily reconciliation. Based on real-world input from a practicing accountant using Xero/Loyvers + PH business context.

| Feature | Status | Notes |
|---------|--------|-------|
| `Payment.method` enum (`CASH`, `GCASH`, `MAYA`, `BANK_TRANSFER`, `CARD`, `CHEQUE`) | ✅ | Migration `20260401020457_add_payment_method`. Default: CASH. |
| Payment method select in submit payment form | ✅ | Sheet UI updated |
| Method column in payments history table | ✅ | With label mapping (GCash, Maya, etc.) |
| Filter payments by method | ✅ | `GET /payments?method=GCASH` |
| Filter payments by amount range | ✅ | `GET /payments?minCents=&maxCents=` |
| Filter orders by amount range | ✅ | `GET /orders?minCents=&maxCents=` |
| Search payments by customer ref / order ID | ✅ | `GET /payments?search=` (joins order.customerRef) |
| SKU search on Inventory History | ✅ | `GET /inventory/movements?skuSearch=` (joins sku.code/name) |
| FilterBar `type: 'number'` field | ✅ | Compact number input with clear button, reusable |
| Seeder updated with PH payment methods | ✅ | Rotates GCASH/MAYA/BANK_TRANSFER/CASH/CARD |
| CSV export includes Method column | ✅ | |

---

### MS19 — Partial Payments (Accounts Receivable) ✅ Done

> Branch: `milestone-19d/stock-transfers-partial-payments`
> Goal: Track partial payments on orders, compute balance automatically, prevent overpayment.

#### What's Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| `POST /orders/:id/pay` endpoint | ✅ | Records payment directly as VERIFIED (cash/on-hand) |
| Overpayment guard | ✅ | Blocks payment if amount > remaining balance |
| Computed paidCents / balanceCents | ✅ | Derived from payments table, no stored fields |
| Multiple payments support | ✅ | Each payment creates new record; aggregate on read |
| Order detail UI | ✅ | Payments card with history, add payment form, paid/balance display |

#### How It Works

1. **Order created** — starts with 0 paid, full balance
2. **Payment recorded** — `POST /orders/:id/pay` with `amountCents` + `method`
3. **Balance computed** — `totalCents - SUM(payments.amountCents)` where status=VERIFIED
4. **Status unchanged** — Order status (PENDING/CONFLICTED/COMPLETED/CANCELLED) is separate from payment status
5. **UI shows** — Total, Paid, Balance, Payment History, "+ Record payment" button

#### API Response

```json
{
  "payment": { "id": "...", "amountCents": 5000, "method": "CASH", "createdAt": "..." },
  "totalCents": 10000,
  "paidCents": 5000,
  "balanceCents": 5000
}
```

---

### MS19b — Customers / AR Tab ✅ Done

> Branch: `milestone-19b/reports-customers-tab`
> Goal: AR overview per customer for B2B accounts receivable tracking.

| Feature | Status | Notes |
|---------|--------|-------|
| GET /contacts/ar-overview | ✅ | Lists contacts with unpaid orders, totals |
| Customers tab in Reports | ✅ | AR table with customer, total ordered, paid, balance |
| Payment status per row | ✅ | Shows balance, highlights overdue |

---

### MS19c — BranchType + Feature Flags ✅ Done

> Branch: `milestone-19c/branch-type-feature-flags`
> Goal: Branch type for display/reporting, feature flags for stock transfers and payment terms.

| Feature | Status | Notes |
|---------|--------|-------|
| BranchType enum | ✅ | STANDARD, PRODUCTION, DISTRIBUTION, RETAIL, WAREHOUSE |
| `Branch.type` field | ✅ | Migration `20260402004622_add_branch_type` |
| BranchType in API | ✅ | Included in GET /branches response |
| BranchType badge in UI | ✅ | Page header + branch switcher dropdown |
| Feature flags | ✅ | `stockTransfers`, `paymentTerms` added to Tenant.features |
| Stock Transfers nav | ✅ | Sidebar item (feature-gated, OWNER/ADMIN only) |

---

### MS19e — Branch Stock Transfer Fix ✅ Done

> Branch: `fix/branch-stock-transfer`
> Goal: Fix stock transfer to properly update tenant-wide stock and derive branch stock from movements.

#### The Problem

Stock transfers created movement records (TRANSFER_OUT/TRANSFER_IN) but did NOT update `stockOnHand`. This caused:
- Tenant-wide stock unchanged after transfer
- Branch stock could not be accurately derived

#### The Fix

| Change | Before | After |
|--------|--------|-------|
| Transfer OUT | Movement logged, no stock update | Movement logged + `stockOnHand` decremented |
| Transfer IN | Movement logged, no stock update | Movement logged + `stockOnHand` incremented |
| Branch stock derivation | Not implemented | `getBranchStock()` aggregates movements per branch |

#### How Branch Stock Works

```
branchStock(sku, branch) = 
  SUM(TRANSFER_IN) + SUM(IN) - SUM(TRANSFER_OUT) - SUM(OUT)
```

- **Tenant-wide stock** (`Sku.stockOnHand`) = central control, updated on every transfer
- **Branch stock** = derived from movements aggregation, no duplication
- **Consistency guaranteed**: sum of all branch stock = tenant-wide stock

#### API

| Method | Notes |
|--------|-------|
| `GET /inventory/branch-stock` | New endpoint to query derived branch stock |

#### Validation

Transfer now checks source branch stock (derived from movements) before allowing transfer.

---

### MS19f — Feature Flags + Catalog UI Fixes ✅ Done

> Branch: `fix/feature-flags-products-ui`
> Goal: Add missing feature flags, improve catalog UX, add customer to orders.

#### Feature Flags (Super Admin)

| Flag | Status | Notes |
|------|--------|-------|
| stockTransfers | ✅ | Enable/disable stock transfer feature |
| paymentTerms | ✅ | Enable/disable payment terms feature |

#### Orders - Customer Selection

| Feature | Status | Notes |
|---------|--------|-------|
| Customer required | ✅ | Walk-in default, searchable existing, quick create new |
| Customer at top of sheet | ✅ | Sticky, always visible |

#### Catalog UI Fixes

| Fix | Status | Notes |
|-----|--------|-------|
| CSV Import modal | ✅ | Import UI now in modal/sheet |
| Catalog width increased | ✅ | 2-column grid wider |
| Edit sheet image | ✅ | 100% width, centered |
| Remove edit from Inventory | ✅ | Inventory panel no longer has edit (movements only) |

#### Customer/AR Schema (For Reference)

Contact model has `creditLimitCents` field for credit limit tracking. Full AR/AP models not yet implemented (scope creep - tracking done via Contact + Order balance).

---

### MS19g — Unified Create Item Flow ✅ Done

> Branch: `feat/create-item-modal`
> Goal: Simplify catalog creation UX by merging separate "Create Product" + "Create SKU" forms into a single "Create Item" flow with automatic SKU generation.

#### Backend Changes

| Change | File | Details |
|--------|------|---------|
| Add `code` param | `catalog.controller.ts` | Optional SKU code override in `POST /products/with-stock` body |
| Add `lowStockThreshold` param | `catalog.controller.ts` | Optional threshold in `POST /products/with-stock` body |
| Handle code override | `catalog.service.ts` | If `code` provided, use it (with uniqueness check); otherwise auto-generate via `generateNextSkuCode` |
| Handle lowStockThreshold | `catalog.service.ts` | Pass `lowStockThreshold` to SKU create (was hardcoded to 0) |

#### Frontend Changes

| Component | Change | Details |
|-----------|--------|---------|
| `CreateItemModal` | **New file** | Shared modal: Category, Product Name, SKU Code (auto-generated + "Override" toggle), Cost/Price, Low Stock Threshold, Initial Stock, Photo |
| `CatalogPanel` | Replaced forms | Two side-by-side forms → single "+ Create Item" button → opens `CreateItemModal` |
| `InventoryPanel` | Replaced dialog | Inline "New Product" dialog → shared `CreateItemModal` |
| `CatalogPanel` | Cleanup | Removed unused `createProduct`, `createSku` functions and related state |

#### UX Flow

1. User clicks "+ Create Item" (Products tab) or "New Product" (Inventory tab)
2. Modal opens with Category dropdown auto-selected
3. Auto-SKU code fetched and displayed (e.g., `FOO-0001`)
4. User fills Product Name (required), optional Cost/Price, Low Stock Threshold, Initial Qty, Photo
5. If user wants custom SKU: check "Override" → enter custom code
6. Click "Create Item" → single API call → Product + SKU created atomically
7. Modal closes, lists refresh

#### Architecture Decision

- Used existing `POST /products/with-stock` endpoint (already a transaction)
- Added `code` and `lowStockThreshold` params to extend functionality
- Zero new endpoints, zero new tables, zero new services
- Single `CreateItemModal` component shared between Products and Inventory tabs

#### Products Page Refinement

| Change | Details |
|--------|---------|
| Removed 2-column layout | Single "Items" list (SKU-driven) |
| Removed Stock/Low columns | Inventory concern, not catalog |
| Removed lowStock filter | Inventory concern |
| Added FilterBar | Search + Category filter |
| Added sortable columns | Name, Cost, Price |
| Added pagination | Page info + prev/next |
| ProductThumb in table | Display-only, no inline editing |
| Fixed CSV modal | Better text formatting |
| Hero dropzone in Create/Edit | Full-width image upload |

---

### MS16 — UI/UX Overhaul ✅ Complete

> Full UX redesign based on real client feedback. Inventory restructure, sitewide filter+export pattern, stock approval workflow, role-based dashboard, and settings improvements.

| Phase | Items | Status |
|-------|-------|--------|
| 1 — Quick wins + sitewide filter bar | Labels, nav cleanup, branch badge, role-based dashboard, FilterBar component, Appearance settings | ✅ |
| 2 — DB migration | `approvalStatus`, `reason`, `actorId` on InventoryMovement; `ApprovalStatus` enum; indexes | ✅ |
| 3 — Inventory page rebuild | Products table with category/cost/price, SKU toggle, filter+export, FilterBar | ✅ |
| 4 — New Product modal | Name, category, photo, cost, price, initial qty, auto-SKU (category prefix + counter) | ✅ |
| 5 — Inline stock adjustment | +/− per row, owner/admin immediate APPROVED, staff → PENDING + notification | ✅ |
| 6 — Stock History + Approvals | Movement log tabs (All/Pending/Approved/Rejected), pending badge, approve/reject inline, CSV export | ✅ |
| 7 — Orders filter + export | FilterBar (search + status) + CSV export on orders table | ✅ |
| 8 — Payments filter + export | FilterBar (status) + CSV export on payments history tab | ✅ |
| 9 — Reports page | Three tabs: Orders / Payments / Inventory movements; date range picker; CSV export per tab | ✅ |
| 10 — Dashboard Settings | Widget show/hide toggles (Customize button), localStorage persistence per user per tenant | ✅ |
| 11 — Docs | MILESTONES updated | ✅ |

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
| Payment gateway | PayMongo — NOT manual proof upload (GCash, Maya, cards, recurring billing — PH-native) |
| Feature flag | `marketplace: true` per tenant, controlled by Super Admin |

---

## PHASE 8 — Mobile + POS

> **PWA + responsive web** is pre-staging (see checklist above). React Native native app is Phase 8 — only after real revenue and validated demand.

| Item | Status | Notes |
|------|--------|-------|
| **PWA + mobile responsive web** | ⏳ Pre-staging | `manifest.json`, service worker, responsive CSS pass on `apps/web`. Ships before staging. |
| Mobile app (React Native / Expo) | 🔒 Phase 8 | Only after staging is live, real clients confirmed, and revenue validates the investment. |
| POS + barcode scanning | 🔒 Phase 8 | Requires hardware integrations and dedicated mobile engineer. |

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
| Sidebar UX overhaul — wider, bigger text (18px base), icons on nav items, all values in config | 🟡 Medium | Pre-staging | — | Modern SaaS standard. Current sidebar is functional but compact. Text sizing trend is 17–18px base. Centralize all nav config. |
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
| **Customer-Seller Chat** | 🔒 Locked | Post-Phase 7 | Customer portal | Two tracks: (1) **Internal order notes** — staff/admin attach notes to a specific order, visible within the ERP; low-effort, high-value for B2B ops. (2) **Buyer-facing portal chat** — real-time or async messaging between buyer and seller, tied to an order/session; requires buyer auth, separate portal surface, and WebSocket infra. Do Track 1 first. Track 2 only after the marketplace (Phase 7) is live and validated. |
| **Bill of Materials (BOM) / Recipe Management** | 🟡 Medium | Post-Phase 5 | Stable inventory | ERP term: a finished product is made from N raw material components. Creating 50 pizzas auto-deducts flour, sauce, cheese, etc. Two patterns: (1) **Production BOM** — transform raw → finished goods (production order workflow); (2) **Sales Bundle** — composite SKU that deducts components on each sale. Schema: `SkuComponent(parentSkuId, componentSkuId, quantity)`. When a movement hits a composite SKU, child movements auto-generate for each component. UI: recipe builder on SKU edit page + production order log. Direct value for Metro Pizza Supply (ingredient portioning/pre-packing) and Megabox (product bundles). |
| **i18n + Language Switcher** | 🟢 Low | Post-Phase 5 | Stable UI | All strings currently hardcoded in components — no translation layer. Solution: `next-intl` (Next.js App Router standard). Requires extracting all UI strings to locale JSON files. Large but mechanical lift. Revenue-gate this: only invest when non-English market is validated. ₱ + PH locale already in place. |
| **Franchise Network / Organization Layer (MGN)** | 🔒 Locked | Post-Phase 7 | Multi-tenant stable | Enables MGN (MSME Growth Network International) franchise model. Income model: one-time joining fee (via PayMongo) + platform take-rate % on every transaction. The commission/MLM tree is **agent-based** — agents recruit other agents and earn commissions when their downline transacts. Two design options are **open** (decision deferred — needs business rule confirmation): **(A) Tenant-as-agent** — each franchisee/tenant IS an agent node (simpler; works if every agent also runs their own ERP business); **(B) Dedicated agent entity** — `Agent` is its own record, separate from `Tenant` (a pure recruiter who earns commissions but doesn't need an ERP tenant). See "Product Strategy — MGN Network" section. Gated by `features.network: true`. |
| **Zentral SaaS — Subscription Billing** | 🔒 Locked | Post-Phase 6 | Go-to-market live | Add `Plan` enum to Tenant: `STARTER → PROFESSIONAL → ENTERPRISE → MARKETPLACE`. Gate features by plan. Billing via PayMongo (recurring subscriptions, PH-native — supports GCash, Maya, cards). This IS the productized version of this platform. Same monorepo, same code — no fork. Zentral is the product brand; Ascendex is the parent company that owns and operates it. |

---

## Product Strategy — Zentral by Ascendex / One Codebase

> Decision record: 2026-04-01. Do not revisit until Phase 6 is live.

### Two brands, one codebase

| Brand | Owner | Business model | Surface |
|-------|-------|---------------|---------|
| **Zentral** (by Ascendex) | You (the builder) — Ascendex is the parent company | SaaS subscription — SMB pays monthly/annually via PayMongo recurring | `apps/marketing` (Zentral site) + ERP |
| **MGN (MSME Growth Network International)** | Your brother's company | One-time joining fee per franchisee/distributor (via PayMongo) + platform take-rate % on every transaction | `apps/marketing-mgn` (MGN site) + ERP + Marketplace |

> These are NOT two separate products. Same codebase, same ERP, same API. Different plan tier and feature flags.
> You are the builder and platform owner. MGN is an enterprise licensee/customer of the platform.

### Three surfaces

| Surface | What it is | Who sees it |
|---------|-----------|-------------|
| **ERP** (`apps/web`) | The core product — inventory, orders, payments, reports | All tenants (both Zentral clients and MGN franchisees) |
| **Zentral Marketing** (`apps/marketing`) | Zentral brand site (by Ascendex), self-serve signup CTA, PayMongo subscription onboarding | Prospects who find Zentral directly |
| **MGN Marketing** (`apps/marketing-mgn`) | MGN brand site, demo-focused (MGN sales team closes deals), PayMongo one-time joining fee | MGN prospects and franchisee applicants |
| **Marketplace** (`/marketplace`) | Phase 7 — buyer-facing storefront. MGN-exclusive (`features.marketplace: true`) | End customers of MGN franchisees |

### The answer: one codebase, multiple plan tiers

Do NOT fork. Do NOT duplicate repos. All surfaces run from the same monorepo:

| Plan | Who uses it | Key features | Gated by |
|------|-------------|--------------|---------|
| `STARTER` | Single SMB owner (Zentral) | Current ERP features | Default |
| `PROFESSIONAL` | Multi-branch SMB | + Branch management, advanced reports | `features.*` |
| `ENTERPRISE` | Large operator | + Team management, audit log, advanced permissions | `features.*` |
| `MARKETPLACE` | MGN franchise/distributor network | + Organization layer, cross-tenant dashboard, take-rate ledger, marketplace, MLM tree | `features.network: true` + `features.marketplace: true` |

### Feature flag isolation model (3 layers)

| Layer | Mechanism | What it isolates |
|-------|-----------|-----------------|
| **1 — Feature flags** | `Tenant.features` JSONB (`network`, `marketplace`, `orders`, etc.) | UI panels and API routes per tenant |
| **2 — Organization scope** | `organizationId` on tenant, org-level guards | Cross-tenant data access (MGN franchisor sees all franchisees; Zentral clients never see each other) |
| **3 — Tenant isolation** | `tenantId` on every row, `TenantGuard` on every API route | Data-level: no tenant can ever read another tenant's orders/inventory/payments |

> `features.network: true` = MGN-tier. Never set on a standard Zentral tenant.
> Standard Zentral tenants have `network: false` and `marketplace: false` — no MGN UI or data leaks through.

### MGN network/agent model architecture (when built)

- Franchise network = `Organization` model grouping participants under a franchisor (MGN)
- `Organization.takeRateBps` = platform % on every transaction
- Franchisor dashboard: real gross revenue per agent/franchisee, total platform take, per-transaction ledger
- "No under-the-table" enforcement: the app is the only checkout path
- Joining fee: paid via PayMongo one-time payment before access is provisioned

#### Agent model — decision pending (two options open)

**Option A — Tenant as Agent** (simpler)
- Every agent IS a tenant (runs their own ERP business on the platform)
- `NetworkNode(id, orgId, tenantId, parentNodeId)` — the tree maps tenants
- Commission fires when a payment under any tenant-node is verified
- Works when: every agent in the network is also a franchisee operating their own business

**Option B — Dedicated Agent entity** (more flexible)
- `Agent(id, orgId, userId?, tenantId?, name, code, status)` — separate record, may or may not be linked to a tenant
- A pure recruiter (earns commissions, doesn't run their own store/ERP) is Agent only
- A franchisee who also recruits has both `Tenant` + `Agent` records, linked via `tenantId`
- `NetworkNode(id, orgId, agentId, parentNodeId)` — tree maps agents
- Works when: some network participants are recruiters only, not operators

#### What both options share (the common core)
```
NetworkNode   id, orgId, parentNodeId, [tenantId | agentId]
Commission    id, networkNodeId, paymentId, orderId,
              grossAmountCents, bps, commissionAmountCents,
              status (PENDING | PAID | VOIDED), paidAt
```
- Commission calculated on each `Payment.status → VERIFIED`
- Tree walk: node → parent → grandparent → ... (each ancestor earns their configured bps)
- Payout: batch-mark commissions PAID + record payout date

#### Decision gates (before building)
- Do all agents in MGN's network also run their own ERP business? → Option A
- Are there pure recruiters who earn commissions but don't operate? → Option B
- How many levels deep does commission propagate? (industry standard: 3–5 levels)
- Are commission rates fixed org-wide or per-node/per-level?
- What happens to commissions when an order is cancelled post-verification?

### Payment gateway — PayMongo (PH-native)

> **Stripe is not the right choice for the Philippines.** PayMongo is used instead throughout.

| Use case | PayMongo feature |
|----------|-----------------|
| Zentral monthly subscriptions (by Ascendex) | Recurring billing (PayMongo Subscriptions) |
| MGN one-time joining fee | One-time payment link |
| Marketplace checkout (Phase 7) | Checkout Session (GCash, Maya, cards) |
| Manual proof upload (current) | Not PayMongo — this is the manual fallback for pre-gateway |

### References
- Toast POS — franchise chain management model
- Shopify Plus — brand + merchant network model
- Grab / Foodpanda — platform take-rate on each transaction
- PayMongo — PH payment gateway (GCash, Maya, cards, recurring)

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
