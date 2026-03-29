# Platform Roadmap

> Last updated: 2026-03-30 — MS9 in progress. Deployment order revised: multi-branch v1 moves before staging (scaffolded as invisible default branch). Marketing page (MS11) moved before staging. Tenant self-registration and dashboard added as pre-staging requirements.

---

## Phase Map

| Phase | Milestones | Theme | Status |
|-------|-----------|-------|--------|
| **Phase 1** | MS1–MS2 | Foundation — Auth, Tenants, Users | ✅ Done |
| **Phase 2** | MS3 | Catalog — Products, SKUs, Categories | ✅ Done |
| **Phase 3** | MS4–MS6 | Operations — Inventory, Orders, Payments | ✅ Done |
| **Phase 4** | MS7–MS8 | Hardening — Admin, UI Overhaul, Prod Prep | ✅ Done |
| **Phase 5** | MS9–MS10 | Extensions — CSV Import, Multi-Branch | 🚧 MS9 in progress |
| **Phase 6** | MS11 | Go-to-Market — Marketing Website | 🚧 Pulled forward (before staging) |
| **Phase 7** | — | Marketplace — Customer Storefront | 🔒 Do not build yet |
| **Phase 8** | — | Mobile + POS | 🚫 Prohibited |
| **Phase 9** | — | AWS Scale + Subdomain Routing | 🔒 Do not build yet |

**Rules:**
- MVP = Phase 1–4 (MS1–MS8). This is the first shippable product.
- Phase 5 starts only after MS8 is fully merged and deployed.
- 🔒 = architecturally designed, not yet scheduled. Do not build until explicitly pulled in.
- 🚫 = never implement before reaching that phase. Not a matter of timing — it requires explicit product decision to unlock.
- Do not pull work from a future phase into a current milestone. Ever.

## Pre-Staging Checklist (must complete before deploying to staging)

> These items must be done — in order — before any real client touches the product.

- [ ] **MS9 close** — quick fixes: staff password change, negative stock floor, `customerRef` on orders
- [ ] **Marketing page** — `apps/marketing`, local first, then deployed alongside staging. CTA = "Request a Demo" → Calendly booking. No self-registration (no pricing model yet).
- [ ] **Multi-branch v1** — scaffolded but invisible at single-branch (no UI until 2nd branch added). Prevents risky production migration later.
- [ ] **Dashboard / home screen** — summary of today's orders, pending payments, low stock. Makes the demo compelling.
- [ ] **Staging deployment** — Vercel (web + marketing) + Render (API) + Neon (DB)

> **No tenant self-registration.** All tenants manually provisioned by Super Admin. Prospects book via Calendly → owner demos → owner creates their tenant. Self-serve signup only unlocks when a pricing model and tiers are defined.

---

## PHASE 1 — Foundation (MS1–MS2) ✅

---

### Milestone 1 — Foundation ✅

- Repo scaffold: `apps/api`, `apps/web`, `packages/db`, `infra/`.
- Local Postgres via Docker Compose.
- Prisma wired and first migration runs.
- API boots, connects to DB, `GET /health` works.
- Web boots, calls API health endpoint.
- Structured application logging (request id + request logs).
- Env var strategy documented and `.env.example` present.
- Light/dark mode toggle in web + tenant theme token plumbing (stubbed).

---

### Milestone 2 — Users / Tenants / Auth Foundation ✅

- Users, tenants, memberships.
- Auth baseline (email/password).
- Active tenant context (path + header + membership checks).
- Roles (OWNER, ADMIN, STAFF, VIEWER) seeded.
- PBAC scaffolding: `can_*` permission flags per membership.
- JWT issued on login; validated on all protected routes.
- `GET /auth/me` returns current user.
- Seed: 1 admin user, 1 admin tenant.
- Docs: `ARCHITECTURE.md`, `DATA_MODEL.md` written.

---

## PHASE 2 — Catalog (MS3) ✅

---

### Milestone 3 — Products, SKUs, Categories ✅

- `Category` (platform-owned, no tenantId).
- `Product` (tenant-owned: name, categoryId, isActive).
- `Sku` (tenant-owned: code, name, priceCents, costCents, stockOnHand, lowStockThreshold).
- CRUD for products and SKUs via REST API.
- Tenant isolation enforced at service layer.
- Seed: realistic products + SKUs for 3 demo tenants.

---

## PHASE 3 — Operations (MS4–MS6) ✅

---

### Milestone 4 — Inventory ✅

- `InventoryMovement` (IN / OUT / ADJUSTMENT, referenceType: ORDER / MANUAL).
- `stockOnHand` on `Sku` — only ever mutated via movement, never directly.
- `GET /inventory/movements` — paginated list per tenant.
- `POST /inventory/movements` — manual adjustment (ADMIN+ only).
- Inventory panel UI in web app.

---

### Milestone 5 — Orders ✅

- `Order` (PENDING → CONFIRMED → COMPLETED | CANCELLED).
- `OrderItem` (skuId, quantity, priceAtTime — captured at creation, never updated).
- Editing an order: replaces all items, recalculates total, PENDING only.
- Confirming an order: deducts stock via OUT movement.
- Cancelling a CONFIRMED order: restores stock via IN movement.
- Negative stock prevention: rejects confirmation if stock insufficient.
- Pagination: `GET /orders?page=1&limit=20` returns `{ data, meta }`.
- Orders panel UI with right-side detail Sheet.

---

### Milestone 6 — Payments ✅

- `Payment` (PENDING → VERIFIED | REJECTED).
- Manual proof-of-payment upload (proofUrl).
- Verify / Reject by ADMIN+.
- Pagination: `GET /payments?page=1&limit=20`.
- Payments panel UI with Payables + History tabs.

---

## PHASE 4 — Hardening + Admin (MS7–MS8)

---

### Milestone 7 — Feature Flags + Super Admin ✅

- `Tenant.features` JSONB: `inventory`, `orders`, `payments`, `marketplace`.
- Super Admin role (`isPlatformAdmin: true` on User).
- Super Admin dashboard: tenant list, feature flag toggle, user management.
- `POST /admin/tenants` — Super Admin creates tenants.
- `PATCH /admin/tenants/:id/features` — toggle flags.
- `PATCH /admin/tenants/:id/status` — suspend / reactivate.
- `PATCH /admin/users/:id` — promote / demote Super Admin.
- Feature-flagged sidebar items (Orders hidden if `orders: false`).
- Super Admin dashboard: basic tenant list + feature flag toggle UI.
- `businessType` used only for setting defaults on tenant creation — not used in logic.
- Docs updated: `ARCHITECTURE.md`, `RULES.md`.

---

### Milestone 8 — Hardening + UI Overhaul + Prod Prep ✅

#### Security + API hardening

- ✅ **Password reset flow**: `POST /auth/forgot-password` + `POST /auth/reset-password`. `/reset-password` page in web.
- ✅ **Rate limiting**: `@nestjs/throttler` on all auth endpoints.
- ✅ **Security headers**: Helmet middleware.
- ✅ **CORS**: `CORS_ALLOWED_ORIGINS` env var (comma-separated).
- ✅ **Negative stock prevention**: enforced in `OrdersService.updateOrderStatus`.
- ✅ **Order cancellation restores inventory**: auto IN movement on CONFIRMED → CANCELLED.
- ✅ **Pagination**: `GET /orders`, `GET /payments` accept `?page&limit`, return `{ data, meta }`.
- ✅ **JWT expiry**: `JWT_EXPIRES_IN_SECONDS` default 604800 (7 days dev). No refresh tokens.

#### Super Admin + Tenant lifecycle

- ✅ **Super Admin tenant provisioning**: `POST /admin/tenants`.
- ✅ **Tenant suspend/reactivate**: `Tenant.status` enum (ACTIVE / SUSPENDED), blocked at guard layer.
- ✅ **Super Admin user management**: `PATCH /admin/users/:id`.
- ✅ **Product/SKU archival**: `isArchived` on both. Archive UI in CatalogPanel.

#### Deferred UX from earlier milestones

- ✅ **Root `/` page**: redirects to `/login`.
- ✅ **Tenant route guard**: `TenantShell` redirects non-members to their tenant or `/login`.
- ✅ **Platform admin redirect**: `isPlatformAdmin` users are sent to `/admin` on login, not `/t/*`.
- ✅ **Staff invitation flow**: `/accept-invite?token=...` page. Backend API exists. Email requires SMTP in deployment.

#### Image upload infrastructure

- ✅ **`POST /uploads`**: Multer diskStorage, JwtAuthGuard, 5MB limit, image types only.
- ✅ **Local storage**: `apps/api/uploads/`, served via `express.static`. URL: `${APP_BASE_URL}/uploads/${filename}`.
- ✅ **S3 storage**: switchable via `STORAGE_TYPE=s3`. Uses `@aws-sdk/client-s3`.
- ✅ **SKU image upload**: `ImageUpload` component in CatalogPanel. `PATCH /skus/:id` persists `imageUrl`.
- ✅ **Tenant logo**: `Tenant.logoUrl`. `PATCH /tenant/logo` (OWNER/ADMIN). Upload in sidebar + settings.
- ✅ **User avatar**: `User.avatarUrl`. `PATCH /auth/me`. Upload in user menu dropdown.
- **Image cropping**: deferred to Phase 5 or later.

#### Notifications

- ✅ **`Notification` model**: tenant + user scoped.
- ✅ **`notifyTenant()` helper**: writes to all ACTIVE members.
- ✅ **Triggers**: ORDER_CREATED, ORDER_CONFIRMED, ORDER_CANCELLED, PAYMENT_SUBMITTED, PAYMENT_VERIFIED, PAYMENT_REJECTED.
- ✅ **API**: `GET /notifications`, `PATCH /:id/read`, `PATCH /read-all`, `DELETE /:id`.
- ✅ **Bell UI**: Popover panel, unread badge, mark read, dismiss, "mark all as read", polls every 60s.

#### Auth UI overhaul

- ✅ **Split-screen auth layout** (`AuthLayout`): left form pane, right hero pane.
- ✅ **Login, Register, ForgotPassword, ResetPassword, AcceptInvite pages**.

#### UI overhaul

- ✅ Sidebar: feature-flagged nav, tenant logo header, collapse toggle.
- ✅ Header: breadcrumbs, tenant switcher, notification bell, mode toggle, user menu with avatar.
- ✅ Status badges, pagination UI, right-side Sheet for detail/actions.
- ✅ Orders panel: multi-item display, quantity totals, edit flow.
- ✅ Payments panel: Payables / History tabs.
- ✅ Catalog panel: archive buttons, SKU image upload.
- ✅ Settings: Tenant Profile (logo upload, tenant info). Team tab (placeholder).
- **Data tables with sorting + filtering**: pending.
- **Settings → Team & Permissions PBAC UI**: pending — deferred to Phase 5.
- **Mobile-responsive layout**: pending.

#### QA + deployment

- ✅ **Seed data**: 67 orders / 44 payments / 24 SKUs across 3 tenants. Pagination-friendly.
- ✅ **E2E tests**: 100/100 passing (notifications, uploads included).
- ✅ **Env vars documented**: `.env.example` current.
- **Tenant isolation audit**: pending — run `/tenant-audit` before merge.
- **QA checklist**: pending.
- **Staging/prod deployment**: pending — Vercel + Render + Neon.

#### Data retention rules

- `Order`, `Payment`, `InventoryMovement` are immutable financial records — no delete.
- `Product` / `Sku` use `isArchived` — never deleted.
- `Membership` records are deactivated (`status: INACTIVE`), not deleted.
- `User` and `Tenant` records are never hard-deleted.

---

## PHASE 5 — Platform Extensions (MS9–MS10) 📋

> Starts after MS8 is fully merged and deployed to staging/prod.

---

### Milestone 9 — CSV Import + Team Management 🚧

**Why:** A new client can export their product catalogue from Excel/Sheets and import it in one step. Without this, onboarding a business with 200 SKUs requires manual entry — a real blocker for adoption. Team management allows owners to onboard staff (with or without email).

**Prerequisites:** Stable Product + SKU data model (done in MS3). S3 or local file handling (done in MS8).

#### Definition of done

**CSV Import — Backend:**
- ✅ `POST /catalog/import` — multipart CSV upload, tenant-scoped, JwtAuthGuard + TenantGuard.
- ✅ Supported columns: `productName`, `skuCode`, `skuName`, `priceCents` (or `pricePhp`), `costCents` (or `costPhp`), `categorySlug`, `lowStockThreshold`. Snake_case aliases supported.
- ✅ `pricePhp` / `costPhp` auto-converted to cents (multiply × 100, round).
- ✅ Row-level validation: missing required fields, duplicate `skuCode` within the file, unknown `categorySlug`.
- ✅ Idempotent upsert: existing SKU by `(tenantId, code)` is updated, not duplicated. New codes are created.
- ✅ Response: `{ imported: N, updated: N, skipped: N, errors: [{ row, reason }] }`.
- ✅ E2E tests: happy path, idempotent upsert, validation errors, duplicate handling, 401, tenant isolation.

**CSV Import — Frontend:**
- ✅ Drag-drop CSV upload zone in Catalog panel.
- ✅ Post-import result: imported / updated / error counts. Error rows listed with reasons.
- ✅ "Download template" button — generates CSV with correct headers.
- **Preview table (deferred):** show first 10 rows before confirming — deferred to post-MS10. Slot reserved in the UI design.
- Column mapping UI: deferred — exact headers required; snake_case aliases reduce friction.

**Team Management — Backend:**
- ✅ `GET /memberships/team` — returns all statuses (ACTIVE, INVITED, DISABLED). Fixed missing JwtAuthGuard.
- ✅ `POST /memberships/invite` — email invite with 48h token, link points to `APP_FRONTEND_URL/accept-invite`.
- ✅ `POST /memberships/add-direct` — create staff without email; accepts any unique identifier (nickname, phone, etc.); account immediately ACTIVE.
- ✅ `PATCH /memberships/:id` — update role, job title, deactivate (`status: DISABLED`) or reactivate.
- ✅ `jobTitle` field on `TenantMembership` — informational only, no access control impact.
- ✅ Login DTO accepts any string identifier, not just email format.

**Team Management — Frontend:**
- ✅ Team settings UI: member list with status filter (All / Active / Pending / Deactivated).
- ✅ Inline status badges (Pending, Disabled) on each member row.
- ✅ Edit button → modal to change role and job title.
- ✅ Deactivate / Cancel invite / Reactivate buttons per row (OWNER/ADMIN only, not on own row).
- ✅ Add member dialog: toggle between "Invite by email" and "Add directly" modes.
- ✅ Invite fix: emails now link to frontend (`localhost:3000`), not the API.

---

### Milestone 10 — Multi-Branch Support

**Why:** SMBs in PH often operate multiple physical locations. Example: Manager's Pizza has a central kitchen + satellite outlets; Megabox has a main warehouse + retail counter. Each location manages its own stock, orders, and staff, but the owner sees the consolidated picture.

**Context:** Manager's Pizza (food wholesale + retail distribution) and Megabox (pizza equipment/materials supplier) are two separate *tenants* — that's already solved. Multi-branch is about locations *within* each tenant.

**Deployment strategy:** Multi-branch v1 ships **before staging** as a scaffolded but invisible feature:
- Every tenant auto-gets a **Default Branch** on creation.
- Branch switcher UI only appears when a tenant has more than 1 branch.
- Single-branch tenants see zero UI change.
- This avoids a risky production data migration later when the first client needs a second location.

**Prerequisites:** Stable inventory model (done in MS4). Stable tenant model (done in MS8).

**Design answers locked:**
- Branches have independent inventory pools.
- Tenant dashboard can filter by branch or show aggregated totals.
- Staff can be assigned to one or more branches (empty = all branches).
- Orders belong to a specific branch.

#### Data model changes

```
Branch {
  id          UUID PK
  tenantId    UUID FK → Tenant
  name        String
  address     String?
  status      BranchStatus (ACTIVE | INACTIVE)
  isDefault   Boolean @default(false)
  createdAt   DateTime
  updatedAt   DateTime
}

BranchInventory {
  id          UUID PK
  branchId    UUID FK → Branch
  skuId       UUID FK → Sku
  stockOnHand Int @default(0)
  @@unique([branchId, skuId])
}
```

- `InventoryMovement.branchId` FK added (nullable — historical movements without a branch).
- `Order.branchId` FK added (nullable — historical orders without a branch).
- `TenantMembership.branchIds` — JSON array of Branch IDs the member is assigned to. Empty = access to all branches.
- `Sku.stockOnHand` becomes computed (sum of BranchInventory) or deprecated — decision at design time.
- On tenant creation: auto-create one `Branch` (isDefault: true, name = tenant name).
- On migration: all existing movements and orders assigned to the default branch. Existing `stockOnHand` migrated to default branch's `BranchInventory`.

#### API additions

- `GET /branches` — list branches for tenant.
- `POST /branches` — create branch (OWNER/ADMIN).
- `PATCH /branches/:id` — update name, address, status.
- Branch context: optional `x-branch-id` request header. If omitted → tenant-wide scope (aggregated).
- All inventory movement and order queries respect branch scope.

#### UI changes

- Branch switcher in the sidebar or header (below tenant name).
- Dashboard: "All Branches" default view shows aggregated stock totals, orders, payments.
- Filtered view: select a branch → all panels show that branch's data only.
- Staff can only see branches they're assigned to (or all if no restriction).
- Settings → Branches tab: list, create, edit, deactivate branches.
- Member management: assign/remove branch access per member.

---

## PHASE 6 — Go-to-Market (MS11) 🚧 Pulled forward

---

### Milestone 11 — Marketing Website + GTM

A standalone site (`apps/marketing`) for prospect demos and client pitches. Fully independent of the platform — runs against the prod API URL.

**Timing revised:** Marketing page now builds *before* staging deployment, not after. Reason: the "Get Started" CTA and demo pages are required for client acquisition. Staging with no marketing page = nowhere to send prospects.

**Starts after:** MS9 quick fixes are done. Does not require MS10.

#### Definition of done

- Hero section: headline, subheadline, single CTA — **"Book a Demo"** → Calendly link.
- Features grid: one card per module. Config-driven via `features.config.ts`.
- How-it-works walkthrough: core B2B workflow (add products → receive stock → create order → verify payment).
- Social proof section (placeholder until real client logos/quotes available).
- **No pricing page.** No tiers. No "Get Started" self-signup. Replace with "Contact us" or Calendly.
- Footer with links.
- No server runtime — fully static (`next export` / static generation).
- SEO: meta tags, Open Graph, structured data.
- Fully static (`next export`) — no server runtime.
- AI-generated hero + feature illustrations via `/generate-image` skill.

---

## PHASE 7 — Marketplace 🔒

> Do not build yet. Full design is documented for reference. Unlocks after Phase 4 is stable and there is validated demand.

The marketplace is built on top of the ERP foundation — same inventory, same order system, same payment flow. Tenants need real operational data before opening a storefront.

### Two entry points, one inventory truth

- **Global marketplace** (`/marketplace`) — customers browse across all tenants.
- **Per-tenant storefront** (`/shop/:tenantSlug`) — scoped to one seller.

Both pull from `MarketplaceListing` + `Sku`. No duplication.

### Staff side — listing management

- `can_manage_listings` permission: publish/unpublish SKUs.
- `MarketplaceListing`: can have its own `marketplacePrice` separate from internal `priceCents`.
- Feature-flagged: `marketplace: true` per tenant, controlled by Super Admin.
- Archived SKUs cannot be listed.

### Customer side — browse + buy

- Customer auth separate from staff auth. `CustomerProfile` ≠ `TenantMembership`.
- Multi-tenant cart → splits into separate orders per tenant at checkout.
- Customer sees grouped order summary per seller.

### Routing

```
/marketplace                    → global browse
/marketplace/search?q=...       → search results
/marketplace/category/:slug     → category filter
/shop/:tenantSlug               → per-tenant storefront
/shop/:tenantSlug/products/:id  → product detail
```

### Inventory reservation at checkout

- `MarketplaceListing.reservedQty` field — incremented on cart add, decremented on order confirm or cart abandon.
- `availableQty = stockOnHand - reservedQty` — what customers see.
- Reservation TTL: 30 minutes. Background job clears stale reservations.

### Payment flow

- Integrated payment gateway (Stripe / PayMongo) — NOT manual proof upload.
- Escrow-like model: payment captured at checkout, released to tenant after fulfillment.
- Dispute window before release (configurable).

---

## PHASE 8 — Mobile + POS 🚫

> Prohibited. Do not implement. These phases require dedicated mobile engineers and hardware integrations.

- **Mobile app** (React Native / Expo) — staff-focused, offline-first inventory and order management.
- **POS + Barcode scanning** — mobile-based, integrates with Orders + Payments module.

---

## PHASE 9 — AWS Scale 🔒

> Do not build until traffic demands it. Driven by real load data, not preemptive optimization.

- ECS or EKS container orchestration.
- RDS (Postgres) replacing Neon, with read replicas.
- S3 + CloudFront for static assets and uploads.
- Subdomain routing per tenant: `acme.yourplatform.com`.
- PgBouncer or Prisma Accelerate for connection pooling.

---

## Feature Backlog

> These are designed and ready to scope into a milestone when there is validated need. Not phase-assigned yet. Do not implement speculatively.

### External Notification Delivery (Post-Phase 4)

In-app notifications (bell icon) ship in MS8. External delivery adds channels.

**Channels (implement in this order):**
1. Email — SMTP already wired in MS8. Cheapest channel to add first.
2. Facebook Messenger — primary channel in PH/SEA. Requires Meta App review.
3. WhatsApp Business — same Meta infrastructure. Secondary channel.
4. SMS — Twilio or Semaphore (PH). Last resort fallback.

**Architecture:** Fire-and-forget async via BullMQ job queue. Channel-agnostic strategy pattern — each channel is a swappable implementation.

**Notification preferences UI:** Per-user, per-channel opt-in/out. PBAC-mirrored — you can only subscribe to events you have permission to act on. Add to Settings → Notifications.

**Why deferred:** External channels add queue infrastructure and Meta API dependencies. In-app covers MVP. External delivery only matters when real users miss critical events.

---

### Low Stock Threshold + Alerts (Post-Phase 4)

- `lowStockThreshold` already exists on `Sku`.
- When `stockOnHand` drops to or below threshold after any movement: fire `stock.low` event.
- Dashboard widget: "Low Stock SKUs" list per tenant.
- Integrates with external notification delivery when that ships.
- Add cooldown per SKU (max one alert per 6h) to prevent spam.

**Why deferred:** No value until external notification channels exist.

---

### Order Customer Reference (Post-Phase 4)

- Add `customerRef: String?` and `note: String?` to `Order`.
- `customerRef`: e.g. "PO #12345", "Acme Corp order". Staff-assigned B2B reference.
- `note`: free-text internal note.

**Why deferred:** UX improvement. Does not affect correctness. Easy add when UI is stable.

---

### Queryable Audit Log (Post-Phase 4)

- `AuditLog` table: `id`, `tenantId`, `userId`, `event`, `entityType`, `entityId`, `before` (JSONB), `after` (JSONB), `createdAt`.
- Super Admin: cross-tenant queries. Tenant Admins: own tenant.
- "Who changed this order?" questions.

**Why deferred:** Logger events sufficient for MVP. High value for enterprise clients and compliance.

---

### OAuth / Social Login (Post-Phase 4)

- Google OAuth + Facebook/Meta OAuth alongside email/password.
- `oauthProvider` + `oauthProviderId` fields on `User`.
- JWT still issued after OAuth — same auth contract.

**Why deferred:** Email/password sufficient. OAuth requires app registration and provider testing.

---

### i18n + Currency (Post-Phase 4)

- Language switcher (en, fil, zh). Affects labels, error messages, date and number formats.
- Currency switcher — display only. `priceCents` stays in cents; conversion is display-side.
- `Tenant.locale` + `Tenant.currency`. Per-user overrides (`User.locale?`, `User.currency?`).
- Stack: `react-i18next` + `Intl.NumberFormat`.

**Why deferred:** UI must be stable before wiring i18n. Add after MS8 UI is validated.

---

### Custom Roles (Post-Phase 4)

- `TenantRole` table: named permission presets on top of base roles (OWNER/ADMIN/STAFF/VIEWER).
- Displayed in PBAC UI as base role → custom roles tree.
- Cannot delete a custom role while active members are assigned to it.

**Why deferred:** Per-member permission overrides (MS8) cover 90% of this use case.

---

### Super Admin Impersonation (Post-Phase 4)

- Super Admin temporarily acts as a tenant user for support and debugging.
- Short-lived impersonation JWT: `sub: targetUserId, impersonatedBy: adminId`.
- All audit log entries during impersonation tagged `actorType: IMPERSONATED`.
- Requires explicit exit-impersonation flow in admin UI.

**Why deferred:** Requires full audit trail design. Must not ship without logging.

---

### Platform Integrations — Centralized Inventory Hub (Post-Phase 5)

Connectors listen for webhook events from external platforms and create `InventoryMovement` records. No special-casing in the core model.

**Planned integrations:**
- Shopee (webhook-based order events)
- Lazada (webhook-based order events)
- Custom supplier/distributor API (configurable webhook endpoint)
- Courier APIs — J&T, LBC, Ninja Van (delivery status → order updates)

**Schema:** `Integration` table, `IntegrationEvent` log. `InventoryMovement.referenceType` adds `INTEGRATION` value. Feature-flagged per tenant.

**Why deferred:** Core ERP must be stable first. Webhook security (HMAC signature verification), retry logic, and idempotency add significant complexity.

---

### Payroll Module (Post-Phase 5) 🔒

> Do not build until explicitly pulled in. Requires dedicated product decision — overlaps with accounting software territory.

A payroll module scoped to tenants with staff memberships.

**Scope (when built):**
- `Employee` model linked to `Membership` — stores employment type, rate, pay period.
- Time tracking: clock-in / clock-out logs, tied to `Branch` when multi-branch ships.
- Payroll computation: base pay, deductions (SSS, PhilHealth, Pag-IBIG for PH), net pay.
- Payslip generation (PDF) per pay period.
- Payroll run history — immutable records per run.
- Feature-flagged: `features.payroll`, enabled per tenant by Super Admin.

**Why deferred:** Payroll is a regulated, compliance-heavy domain (tax law, government remittances). Building it prematurely risks legal exposure and significant scope. Must validate demand before committing to this surface.

**Prerequisite:** Multi-Branch (MS10) should ship first — payroll per branch needs branch structure in place.

---

### AI Chatbot + RAG (Post-Phase 5)

Staff ask natural-language questions about their own data: "What's the stock on Bolt M8?", "Show me unpaid orders this week."

- Strictly tenant-scoped — chatbot never sees cross-tenant data.
- Stack: Claude API (`@anthropic/sdk`) + pgvector on Neon (RAG over tenant data).
- Feature-flagged: `features.ai_chatbot`, enabled per tenant by Super Admin.
- Phase 7 extension: customer-facing marketplace chatbot (cross-tenant, public data only).

**Why deferred:** Requires stable data model and real tenant data to be useful.

---

## Known Engineering Challenges

> Documented to inform future planning — not blockers for MS8.

| Challenge | Impact | Mitigation |
|-----------|--------|------------|
| **Permission drift** | Staff accumulate custom overrides; role changes may leave conflicts. | Add "reset to role default" action in PBAC UI. |
| **Privilege escalation** | ADMIN must not grant permissions exceeding their own ceiling. | Guards validate acting user's scope, not just target role. |
| **JWT token lag** | Permission changes take effect at next login (7-day JWT). | Check `membership.status` on every protected request, not just at token issue. |
| **Concurrent order confirmation race** | Two simultaneous CONFIRM requests both pass stock check before either deducts. | Mitigated by `$transaction` wrapping stock check + decrement. |
| **Low stock alert spam** | Stock hovering at threshold fires alert on every OUT movement. | Cooldown per SKU (max one alert per 6h) or `lastAlertedAt` field. |
| **Messenger / WhatsApp template constraint** | Meta only allows free-form messages within 24h reply window. | Register message templates per notification type before launch. |
| **Render cold starts** | Free tier spins down after ~15min idle. First request takes 10–30s. | Document for testing; upgrade to Render Starter ($7/mo) before real users. |
| **Neon connection exhaustion** | Prisma opens a connection per request. Free tier has low ceiling. | Add PgBouncer or Prisma Accelerate before production load. |
| **Branch migration risk** | MS10 changes `stockOnHand` semantics (per-branch vs total). | Plan migration carefully; existing data moves to default branch. Test on staging first. |
| **Integration webhook security** | External platforms must authenticate their webhook payloads. | Verify HMAC signatures on all incoming requests. Never trust payload without verification. |
