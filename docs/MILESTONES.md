# Milestones

This project is delivered milestone-by-milestone. Do not pull work forward.

> Last updated: 2026-03-28 — Audit pass: added production-critical items to MS8, moved UI overhaul into MS8, added Post-MVP notification, OAuth, low-stock, audit-log, and order-reference sections.

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

## Milestone 4 - Inventory Movement ✅

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

## Milestone 5 - Orders ✅

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

## Milestone 6 - Payments (Manual Verification) ✅

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

## Milestone 7 - Feature Flags + Super Admin Controls ✅

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

## Milestone 8 - Hardening + UI Overhaul + Prod Prep

Definition of done:

### Security + API hardening

- **Password reset flow**: `POST /auth/forgot-password` + `POST /auth/reset-password`. Sends a time-limited token via email. Required before any real user can recover their account.
- **Rate limiting**: `@nestjs/throttler` on all auth endpoints (`/auth/login`, `/auth/register`, `/auth/forgot-password`). Blocks brute force.
- **Security headers**: Helmet middleware on the NestJS app. One-line add, production hygiene.
- **CORS**: Explicit allowed origins configured for production (not wildcard). Coordinated with Vercel deployment URL.
- **Negative stock prevention**: Enforce in `InventoryService` and `OrdersService` — reject movements or order confirmations that would push `stockOnHand` below zero.
- **Order cancellation restores inventory**: When a `CONFIRMED` order is cancelled, automatically log an `IN` movement to restore stock. (Currently: stock deducted on CONFIRMED, but not restored on CANCELLED.)
- **Pagination**: All list endpoints (`GET /orders`, `GET /payments`, `GET /inventory/movements`, `GET /catalog/skus`) must accept `?page=1&limit=20` and return paginated results. Unbounded list queries are a production performance risk.
- **JWT expiry**: `JWT_EXPIRES_IN_SECONDS` already exists in env. Document and enforce a sensible default (86400 = 24h). No refresh tokens in MVP — users re-login after expiry. Revisit post-MVP.

### Super Admin + Tenant lifecycle

- **Super Admin tenant provisioning**: `POST /admin/tenants` — Super Admin creates tenants directly with businessType + default features. Currently only possible via seed.
- **Tenant suspend/reactivate**: Add `status` enum (`ACTIVE`, `SUSPENDED`) to `Tenant` model (migration required). Super Admin can suspend or reactivate. Suspended tenants are blocked at the guard layer — all data preserved. Hard delete not supported.
- **Super Admin user management**: Super Admin can promote another user to Super Admin via `PATCH /admin/users/:id` (currently only possible via seed/DB).
- **Product/SKU archival**: Add `isArchived: boolean` to `Sku` (and optionally `Product`). Archived SKUs cannot receive new orders but remain on historical records. Exposed via Super Admin or tenant OWNER/ADMIN.

### Deferred UX items from earlier milestones

- Root `/` page: replace dev convenience landing page with a redirect to `/login`.
- Tenant route guard: `/t/[tenantSlug]` shows API 403 for non-members instead of redirecting. Add page-level membership check that redirects to the user's tenant or `/login`.
- Tenant staff invitation flow: UI for tenant owners to invite users as staff members (memberships API exists, invite flow does not).

### UI overhaul (replace scaffolding panels with production UI)

- Proper application shell: sidebar navigation, top header, breadcrumbs.
- **In-app notification center**: bell icon in the top header with unread badge count. Dropdown panel lists recent notifications — each shows title, body, timestamp, and a link to the related entity (order, payment, SKU). Mark as read on click, dismiss button per notification, "Mark all as read" action. Badge clears when all are read. Polling every 60s — no WebSocket in MVP.
- Data tables with sorting, filtering, and pagination for orders, SKUs, inventory movements.
- Modals for create/edit flows (orders, SKUs, products).
- Tabs for switching between related views (e.g. Products / SKUs / Movements).
- Status badges, action menus, confirmation dialogs.
- Wire toast/alert system consistently across all panels.
- Orders: proper cards with SKU line-items, cleaner breakdown.
- Payments: show order summary inline.
- Mobile-responsive layout.
- Use AI-generated + optimized images for product placeholders (`/generate-image`, `/optimize-images` skills).

### QA + deployment

- Seed data expanded: 3 realistic businesses with products, SKUs, inventory, orders, payments — all with `isArchived`, `status`, and pagination-friendly record counts.
- Tenant isolation audit: run `/tenant-audit` and resolve all violations.
- QA checklist completed.
- Staging/prod deployment verified: Vercel (web) + Render (API) + Neon Postgres (DB).
- All env vars documented in `ENVIRONMENT.md` and `.env.example` current.
- All docs reflect final state.

Notes on data retention and soft deletes:
- `Order`, `Payment`, `InventoryMovement` are immutable financial records — no delete, no soft delete.
- `Product` / `SKU` use `isArchived` flag — added in this milestone.
- `Membership` records are deactivated (`status: INACTIVE`), not deleted.
- `User` records are never deleted.
- `Tenant` records use `SUSPENDED` status — never hard-deleted.
- Full `deletedAt` soft-delete columns are NOT used — entity-specific patterns are cleaner.

---

## Post-MVP: Notifications Module — External Delivery (after MS8)

The in-app notification center (bell icon + panel) ships in MS8 and writes to a `Notification` DB table. This post-MVP module adds **external delivery** of those same notification events via email, SMS, and Messenger/WhatsApp.

### Two-layer architecture

**Layer 1 — In-app (MS8, ships first):**
- `Notification` table stores every event per recipient.
- Bell icon + badge + dropdown panel in the UI consumes this table.
- No external services — self-contained.

**Layer 2 — External delivery (this module, post-MS8):**
- Same notification events dispatched to external channels based on per-user preferences.
- Fire-and-forget async (never blocks the request). BullMQ job queue for reliability.
- Each channel is a strategy — email, SMS, Messenger, WhatsApp are interchangeable implementations.

### Supported external channels (implement in this order)

1. **Email** — Resend or Nodemailer + SMTP. SMTP infrastructure already set up in MS8 for password reset. Email is the cheapest channel to add first.
2. **Facebook Messenger** — Meta Cloud API. Best fit for PH/SEA markets where Messenger is primary business comms. Tenant configures their Facebook Page ID in tenant settings. Requires Facebook App review for production use.
3. **WhatsApp Business** — Meta Cloud API (same API as Messenger). Tenant provides their WhatsApp Business phone number. Most important channel for B2B in PH/SEA — owners check WhatsApp constantly.
4. **SMS** — Twilio or Semaphore (PH local). Fallback for users not on Messenger/WhatsApp. Lower priority.

### Events matrix

| Event | Super Admin | Tenant Owner/Admin | Staff (Member) | Notes |
|---|---|---|---|---|
| `order.created` | — | ✓ | ✓ | New sale — staff may need to process |
| `order.confirmed` | — | ✓ | ✓ | Order moving forward |
| `order.cancelled` | — | ✓ | ✓ | Heads up, may need to restock |
| `payment.submitted` | — | ✓ | ✓ (if can_verify) | Payment needs manual verification |
| `payment.verified` | — | ✓ | — | Sale confirmed |
| `payment.rejected` | — | ✓ | — | Customer needs to resubmit |
| `stock.low` | — | ✓ | ✓ | SKU below `lowStockThreshold` — reorder needed |
| `staff.added` | — | ✓ | — | New member granted access |
| `tenant.suspended` | ✓ | ✓ (their tenant) | — | Platform action |
| `platform.alert` | ✓ | — | — | System-level events for SA only |

### Per-user notification preferences

Users configure which channels they want per event category:
- `UserNotificationPreferences` model: `userId`, `tenantId`, `emailEnabled`, `smsEnabled`, `messengerEnabled`, `whatsappEnabled`, `phoneNumber`, `messengerPageScopedId`
- In-app is always on — cannot be disabled.
- External channels are opt-in, configured in the user's profile settings.
- Tenant OWNER can set defaults for new staff members.

### Why in-app ships in MS8 but external delivery is post-MVP

In-app is a DB table + a few API endpoints + UI component — fits the MS8 UI overhaul scope. External delivery requires: SMTP beyond password reset, Facebook App review (takes days), WhatsApp Business account verification, per-user preference UI, and a job queue. That's a full module worth of work that shouldn't block MS8 shipping.

---

## Post-MVP: Low Stock Threshold + Alerts (after MS8)

- Add `lowStockThreshold: Int?` field to `Sku`.
- When `stockOnHand` drops to or below `lowStockThreshold` after any `InventoryMovement`, fire a `stock.low` event.
- Tenant OWNER/ADMIN can set `lowStockThreshold` per SKU.
- Dashboard widget: "Low Stock SKUs" list per tenant.
- Integrates with Notifications Module (`stock.low` → Messenger/email alert).

**Why deferred:** `lowStockThreshold` on SKU is a schema addition with no value until the notification channel is in place. Ship together with the Notifications Module.

---

## Post-MVP: OAuth / Social Login (after MS8)

- Google OAuth + Facebook/Meta OAuth.
- Use `passport-google-oauth20` and `passport-facebook` strategies.
- Auth design must NOT change — JWT is still issued after OAuth login. OAuth is just an alternative identity verification step.
- Add `oauthProvider` + `oauthProviderId` fields to `User` — email/password and OAuth can coexist.
- Do NOT require social login — it must be opt-in alongside email/password.

**Why deferred:** Email/password is sufficient for MVP. Social login requires OAuth app registration, redirect URI configuration, and testing across providers. Not worth the complexity before MS8.

---

## Post-MVP: Queryable Audit Log Table (after MS8)

- Replace logger-only audit events with a real `AuditLog` table.
- Fields: `id`, `tenantId`, `userId`, `event`, `entityType`, `entityId`, `before` (JSONB), `after` (JSONB), `createdAt`.
- Super Admin can query audit logs across tenants. Tenant admins can query their own.
- Useful for: debugging, compliance, "who changed this order?" questions.

**Why deferred:** Logger events are sufficient for MVP. A real audit table is high value for enterprise clients but adds write overhead to every mutation. Design after data model is stable.

---

## Post-MVP: Order Customer Reference (after MS8)

- Add `customerRef: String?` and `note: String?` to `Order`.
- `customerRef`: e.g. "PO #12345", "Acme Corp order". Staff-assigned reference for B2B order tracking.
- `note`: free-text internal note.
- Exposed in the order create/update flow.

**Why deferred:** MVP proves the order flow works. Customer references are a UX improvement that doesn't affect correctness. Add when the UI overhaul is done (MS8) or immediately after.

---

## Post-MVP: Bulk Data Import (after MS8)

- CSV upload for bulk Product + SKU creation per tenant.
- Universal CSV shape (name, sku_code, price_cents, cost_cents, category_slug, low_stock_threshold) — same format regardless of `businessType`.
- Validation: duplicate SKU codes, unknown categories, missing required fields reported per row.
- S3 or local file handling for upload (coordinate with Phase 8 AWS work).
- `businessType` does NOT change CSV shape — it only sets default feature flags on tenant creation.

**Why deferred:** Not needed for platform to function. High value before real customer onboarding. Scope after MS8 when all data models are stable.

---

## Post-MVP: Advanced User Management (after MS8)

- Super Admin PBAC: configurable permissions per platform admin (read-only admin, billing-only admin, etc.) — currently `isPlatformAdmin` is boolean only.
- Cross-tenant relationships: tenant A granting tenant B specific access (supplier/reseller model) — needs design work before implementation; could overlap with Marketplace phase.

**Why deferred:** Current Super Admin model (boolean `isPlatformAdmin`) is sufficient for MVP. Cross-tenant relationships need product design before engineering.

---

## Future Phases (DO NOT IMPLEMENT)

| Phase | Scope |
|---|---|
| Phase 5 | Mobile app (React Native / Expo) — staff-focused, offline-first |
| Phase 6 | POS + Barcode scanning (mobile-based, uses Orders + Payments) |
| Phase 7 | Marketplace — customer-facing UI, multi-tenant selling |
| Phase 8 | AWS scaling — ECS, RDS, S3, CloudFront, **subdomain routing per tenant** (e.g. `acme.yourplatform.com`) |

If a feature belongs to Phase 5+, do NOT implement. Document it and assign to the appropriate future phase.
