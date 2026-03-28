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

**App shell and navigation:**
- Sidebar navigation with sections: Dashboard, Inventory, Orders, Payments, Catalog, Settings.
- Top header with tenant name, user avatar/menu, and notification bell.
- Breadcrumbs for nested views.
- Feature-flagged sidebar items — if `orders` is disabled for a tenant, the Orders item is hidden.

**In-app notification center (bell icon):**
- Bell icon in the top header with an unread badge count (e.g. `3`).
- Clicking opens a dropdown panel: list of recent notifications, each showing title, body text, timestamp, and a clickable link to the related entity (order, payment, SKU).
- Clicking a notification navigates to the entity and marks the notification as read.
- Dismiss button (×) per notification to remove it from the list.
- "Mark all as read" action at the top of the panel.
- Badge clears when all notifications are read.
- Panel fetches on open + polls every 60s when the page is active. No WebSocket in MVP.
- Notifications are written server-side only — never from the frontend.

**Settings section (in sidebar):**
- **Tenant Profile** — name, slug (read-only), businessType display.
- **Team & Permissions** — PBAC management UI (see below).
- Notification Preferences — post-MVP, added when external delivery channels ship.

**Team & Permissions (PBAC management UI):**
- Accessible from Settings → Team & Permissions.
- Two tabs: **Roles** (read-only reference) and **Members** (editable).
- Roles tab: shows each role (OWNER, ADMIN, MEMBER, VIEWER) and its default permission bundle as a read-only tree grouped by module (Inventory, Orders, Payments, Catalog, Team). Informs tenant owners what each role can do before assigning it.
- Members tab: lists all active tenant members. Expanding a member shows their role + all permissions as checkboxes. Overridden permissions (changed from role default) are visually highlighted.
- Permission groups are feature-gated: if the `orders` module flag is disabled by the Super Admin, the Orders permission group shows "Module not enabled" — greyed out, not editable.
- Edit rules: OWNER can edit ADMIN, MEMBER, VIEWER. ADMIN can edit MEMBER, VIEWER only. MEMBER/VIEWER see their own permissions as read-only (viewable in their profile).
- Saving a membership permission override calls `PATCH /memberships/:id/permissions`.

**Other UI items:**
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

## Post-MVP: Notifications — External Delivery + Preferences UI (after MS8)

The in-app notification center (bell icon + panel) ships in MS8 and is always-on. This post-MVP module adds two things: **external delivery** of those same events to email/SMS/Messenger, and a **notification preferences control page** where users configure what they receive and on which channels.

### Two-layer architecture

**Layer 1 — In-app (ships in MS8):**
- `Notification` DB table written server-side on each event.
- Bell icon dropdown UI consumes this table. Always on, no preferences needed.

**Layer 2 — External delivery (this module):**
- Same events dispatched to external channels based on per-user preferences.
- Fire-and-forget async via BullMQ job queue (never blocks the request).
- Channel-agnostic strategy pattern — each channel is a swappable implementation.

### External channels (implement in this order)

1. **Email** — SMTP already set up in MS8 for password reset. Cheapest channel to add first.
2. **WhatsApp Business** — Meta Cloud API. Most important for B2B in PH/SEA — owners check WhatsApp constantly. Tenant provides their WhatsApp Business phone number.
3. **Facebook Messenger** — Meta Cloud API (same API as WhatsApp). Tenant configures their Facebook Page ID. Requires Facebook App review for production.
4. **SMS** — Twilio or Semaphore (PH local). Fallback for users not on Messenger/WhatsApp.

### Events matrix

| Event | Super Admin | Tenant Owner/Admin | Staff (Member) | Notes |
|---|---|---|---|---|
| `order.created` | — | ✓ | ✓ | New sale — staff may need to process |
| `order.confirmed` | — | ✓ | ✓ | Order moving forward |
| `order.cancelled` | — | ✓ | ✓ | May need to restock |
| `payment.submitted` | — | ✓ | ✓ (if `can_verify_payments`) | Needs manual verification |
| `payment.verified` | — | ✓ | — | Sale confirmed |
| `payment.rejected` | — | ✓ | — | Customer must resubmit |
| `stock.low` | — | ✓ | ✓ | Below `lowStockThreshold` — reorder needed |
| `staff.added` | — | ✓ | — | New member granted access |
| `tenant.suspended` | ✓ | ✓ (their tenant) | — | Platform action |
| `platform.alert` | ✓ | — | — | System-level SA-only events |

### Notification preferences control page

Location: Settings → Notifications (added to the sidebar when this module ships).

**Design: PBAC-mirrored matrix**

Notification subscriptions are derived from permissions — you can only subscribe to events you have the permission to act on. If a staff member doesn't have `can_verify_payments`, the PAYMENT_SUBMITTED row is hidden from their preferences. If they must verify payments, PAYMENT_SUBMITTED is mandatory and the checkbox is locked on.

Three-level hierarchy:
1. **System defaults** — hardcoded per-role event map (OWNER gets everything, MEMBER gets operational events only)
2. **Tenant role defaults** — OWNER can override defaults per role ("turn off ORDER_CREATED for all MEMBERs in my tenant")
3. **Per-user overrides** — individual user can opt out of non-mandatory notifications, within what their role allows

**UI shape:**
- Tabs: **My Preferences** (current user) + **Team Defaults** (OWNER/ADMIN only)
- My Preferences: rows = notification types, columns = channels (In-App always-on, Email, SMS, Messenger, WhatsApp). Checkboxes where enabled, greyed where locked or not applicable.
- Team Defaults: same matrix but per role — changes apply as defaults for all members of that role.
- Locked (mandatory) cells show a lock icon with tooltip: "Required for your role permissions."
- Hidden rows: events outside the user's permission scope don't appear.

**Who controls what:**
- OWNER: full access — can edit their own prefs and set defaults for any role below OWNER.
- ADMIN: can edit their own prefs and set defaults for MEMBER/VIEWER.
- MEMBER/VIEWER: can only edit their own non-mandatory preferences.

**Why deferred:** In-app is always-on so no preferences UI is needed for it. External channel preferences only matter once email/Messenger/WhatsApp are wired. Building the prefs UI before the channels exist is premature.

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
