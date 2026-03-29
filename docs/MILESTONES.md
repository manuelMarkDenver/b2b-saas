# Milestones

This project is delivered milestone-by-milestone. Do not pull work forward.

> Last updated: 2026-03-29 — Channel priority corrected (Messenger > WhatsApp for PH/SEA). Added staff invitation email to MS8. Added Post-MVP: i18n/currency, platform integrations, custom roles. Added known engineering challenges. Marketplace reaffirmed as Phase 7 goal. MS8 in-progress: completed items marked ✅.

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

- Tenant roles (OWNER, ADMIN, STAFF, VIEWER).
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
- Edit order (PENDING only): `PATCH /orders/:id` replaces items and recalculates total. Non-PENDING orders return 400.
- Tenant-scoped: all queries filter by `tenantId`.
- Audit log event: `order.created`, `order.updated`, `order.status_changed`.
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

## Milestone 8 - Hardening + UI Overhaul + Prod Prep (in progress)

Definition of done:

### Security + API hardening

- ✅ **Password reset flow**: `POST /auth/forgot-password` + `POST /auth/reset-password`. Sends a time-limited token via email. `/reset-password` page added to web.
- ✅ **Rate limiting**: `@nestjs/throttler` on all auth endpoints (`/auth/login`, `/auth/register`, `/auth/forgot-password`). Blocks brute force.
- ✅ **Security headers**: Helmet middleware on the NestJS app.
- ✅ **CORS**: Explicit allowed origins configured via `CORS_ALLOWED_ORIGINS` env var (comma-separated). Falls back to wildcard in dev only.
- ✅ **Negative stock prevention**: Enforced in `OrdersService.updateOrderStatus` — rejects order confirmation if any SKU has insufficient stock.
- ✅ **Order cancellation restores inventory**: Cancelling a `CONFIRMED` order automatically logs an `IN` movement and restores `stockOnHand`.
- ✅ **Pagination**: `GET /orders`, `GET /payments` accept `?page=1&limit=20` and return `{ data, meta }`. UI implements pagination via `<Pagination>` component.
- ✅ **JWT expiry**: `JWT_EXPIRES_IN_SECONDS` default 604800 (7 days for dev). No refresh tokens in MVP.

### Super Admin + Tenant lifecycle

- ✅ **Super Admin tenant provisioning**: `POST /admin/tenants` — Super Admin creates tenants directly.
- ✅ **Tenant suspend/reactivate**: `Tenant.status` enum (`ACTIVE`, `SUSPENDED`). Super Admin can suspend/reactivate. Suspended tenants blocked at guard layer.
- ✅ **Super Admin user management**: `PATCH /admin/users/:id` to promote to Super Admin.
- ✅ **Product/SKU archival**: `isArchived` on `Product` and `Sku`. Archived SKUs cannot receive new orders. Archive UI in CatalogPanel with `PATCH /products/:id/archive` and `PATCH /skus/:id/archive`.

### Deferred UX items from earlier milestones

- ✅ **Root `/` page**: Redirects to `/login`.
- ✅ **Tenant route guard**: `TenantShell` checks membership — redirects to first active tenant or `/login` if not a member.
- **Tenant staff invitation flow**: UI for tenant owners to invite users. Flow: invite token → email → `/accept-invite?token=...` page sets password. ✅ Backend API exists, ✅ `/accept-invite` page exists. Email sending requires SMTP configured in deployment env.

### Image upload infrastructure

- ✅ **`POST /uploads`** — Multer diskStorage, JWT-authenticated. Accepts image/jpeg, image/png, image/webp, image/gif up to 5MB.
- ✅ **Local storage**: Files saved to `apps/api/uploads/`, served via `express.static` at `/uploads/*`. URL format: `${APP_BASE_URL}/uploads/${filename}`.
- ✅ **S3 storage**: Switchable via `STORAGE_TYPE=s3` env var. Uses `@aws-sdk/client-s3` + `PutObjectCommand`. Public URL uses `AWS_S3_PUBLIC_URL/${key}`.
- ✅ **SKU image upload**: `ImageUpload` component in CatalogPanel. Click-to-upload, hover overlay, remove button. `PATCH /skus/:id` persists `imageUrl` to DB.
- ✅ **`imageUrl` in orders/payments UI**: SKU thumbnails shown in order rows and payment detail.
- ✅ **Tenant logo upload**: `logoUrl` on `Tenant`. Sidebar header shows logo with `ImageUpload` (OWNER/ADMIN). Settings profile page also has logo upload.
- ✅ **User avatar upload**: `avatarUrl` on `User`. User menu dropdown shows avatar with `ImageUpload`. `PATCH /auth/me` persists it.
- **Image cropping**: deferred to MS9 (Milestone-adjacent, not DoD-required).

### Notifications backend

- ✅ **`Notification` model**: persists in DB, tenant + user scoped.
- ✅ **`notifyTenant()` helper**: writes notifications to all ACTIVE tenant members.
- ✅ **Notification triggers**: ORDER_CREATED, ORDER_CONFIRMED, ORDER_CANCELLED, PAYMENT_SUBMITTED, PAYMENT_VERIFIED, PAYMENT_REJECTED.
- ✅ **Notifications API**: `GET /notifications`, `PATCH /:id/read`, `PATCH /read-all`, `DELETE /:id`.
- **Notification bell UI in header**: pending (notification center dropdown).

### Auth UI overhaul

- ✅ **Fancy split-screen auth layout** (`AuthLayout`): left form pane, right hero pane with grid overlay, animated blobs, rotating quotes.
- ✅ **Login page**: uses `AuthLayout`.
- ✅ **Register page**: uses `AuthLayout` with error handling.
- ✅ **Forgot password page**: uses `AuthLayout`.
- ✅ **Reset password page** (`/reset-password?token=...`): reads token from URL, validates, PATCH /auth/reset-password.
- ✅ **Accept invite page** (`/accept-invite?token=...`): reads token, POST /memberships/accept-invite.

### UI overhaul (replace scaffolding panels with production UI)

**App shell and navigation:**
- ✅ Sidebar navigation: Dashboard, Inventory, Orders, Payments, Catalog, Settings.
- ✅ Top header: tenant name, user avatar/menu, notification bell.
- ✅ Feature-flagged sidebar items.

**In-app notification center (bell icon):**
- ✅ Bell icon with unread badge count.
- ✅ Popover panel with notification list: title, body, timestamp, unread dot.
- ✅ Mark as read (click notification) + dismiss (×) per notification.
- ✅ "Mark all as read" action.
- ✅ Polls every 60s when page is active.

**Settings section (in sidebar):**
- **Tenant Profile**: pending.
- **Team & Permissions PBAC UI**: pending.

**Other UI items:**
- ✅ Status badges consistently applied (orders, payments).
- ✅ Pagination UI across orders and payments tabs.
- ✅ Toast/alert system wired across all panels.
- ✅ Right-side Sheet for order detail + actions.
- ✅ Payments: tabs for Payables / History.
- **Data tables with sorting/filtering**: pending.
- **Modals for create/edit**: pending (current: inline forms).
- **Mobile-responsive layout**: pending.

### QA + deployment

- **Seed data expanded**: pending — needs pagination-friendly record counts and `isArchived` coverage.
- **Tenant isolation audit**: pending.
- **QA checklist**: pending.
- **Staging/prod deployment**: pending — Vercel + Render + Neon.
- ✅ All env vars for storage documented in `.env.example`.
- **All docs fully reflect final state**: in progress.

Notes on data retention and soft deletes:
- `Order`, `Payment`, `InventoryMovement` are immutable financial records — no delete, no soft delete.
- `Product` / `SKU` use `isArchived` flag — added in this milestone.
- `Membership` records are deactivated (`status: INACTIVE`), not deleted.
- `User` records are never deleted.
- `Tenant` records use `SUSPENDED` status — never hard-deleted.
- Full `deletedAt` soft-delete columns are NOT used — entity-specific patterns are cleaner.

---

## Milestone 9 - Marketing Website + GTM

A standalone marketing/landing site (`apps/marketing`) separate from the platform app (`apps/web`). Purpose: prospect demos, client pitches, and showcasing platform capabilities to non-technical stakeholders.

**Sequencing:** Starts after MS8 merges. Fully independent of the platform — runs against the prod/staging API URL.

### Definition of done

**Site structure:**
- Hero section — headline, subheadline, CTA buttons (Request Demo / Get Started)
- Features grid — one card per enabled module (Inventory, Orders, Payments, Catalog, Team Management). Config-driven: add/remove sections by editing `features.config.ts`, no hardcoded content.
- How-it-works walkthrough — step-by-step visual flow showing the core B2B workflow (add products → receive stock → create order → verify payment)
- Live demo embed or GIF previews pulled from real screen recordings of `apps/web`
- Stats / social proof section (placeholder metrics until real data is available)
- Pricing / plans placeholder (CTA to contact)
- Footer with links

**Dynamic feature gating:**
- `apps/marketing/src/config/features.config.ts` — array of platform modules, each with: `id`, `enabled`, `title`, `description`, `screenshot`, `gifUrl`. Features section only renders `enabled: true` entries.
- When a new module ships, update this config — no other changes needed to show/hide it.

**AI-generated assets:**
- Hero illustration and feature section images generated via `/generate-image` skill (DALL-E / Stability AI)
- Optional: AI voiceover on a main demo video via `/generate-voiceover` skill (OpenAI TTS / ElevenLabs)
- Both skills are reusable across the full platform (e.g. product image placeholders in the catalog)

**Tech stack:**
- Next.js (consistent with monorepo), Tailwind CSS, Framer Motion for scroll animations
- `apps/marketing` workspace added to `pnpm-workspace.yaml`
- Fully static (`next export`) — no server-side runtime needed for the marketing site
- SEO: `next/head` meta tags, Open Graph, structured data

**Content:**
- Real screen recordings of `apps/web` as GIFs / short video clips (MP4)
- AI-generated hero + feature illustrations
- Copy written to a B2B hardware/food/retail audience (matches seed business types)

**Skills created (reusable):**
- `/generate-image` — generates images via AI API given a prompt and output path
- `/generate-voiceover` — generates MP3 voiceover from a script via TTS API

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

1. **Email** — SMTP already set up in MS8 for password reset. Cheapest channel to add first. No Meta dependency.
2. **Facebook Messenger** — Meta Cloud API. Primary channel in PH/SEA — most B2B communication happens here. Tenant configures their Facebook Page ID. Requires Facebook App review for production.
3. **WhatsApp Business** — Meta Cloud API (same infrastructure as Messenger). Secondary channel. Tenant provides their WhatsApp Business phone number.
4. **SMS** — Twilio or Semaphore (PH local). Last resort fallback for users not on Messenger/WhatsApp.

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
1. **System defaults** — hardcoded per-role event map (OWNER gets everything, STAFF gets operational events only)
2. **Tenant role defaults** — OWNER can override defaults per role ("turn off ORDER_CREATED for all STAFF in my tenant")
3. **Per-user overrides** — individual user can opt out of non-mandatory notifications, within what their role allows

**UI shape:**
- Tabs: **My Preferences** (current user) + **Team Defaults** (OWNER/ADMIN only)
- My Preferences: rows = notification types, columns = channels (In-App always-on, Email, SMS, Messenger, WhatsApp). Checkboxes where enabled, greyed where locked or not applicable.
- Team Defaults: same matrix but per role — changes apply as defaults for all members of that role.
- Locked (mandatory) cells show a lock icon with tooltip: "Required for your role permissions."
- Hidden rows: events outside the user's permission scope don't appear.

**Who controls what:**
- OWNER: full access — can edit their own prefs and set defaults for any role below OWNER.
- ADMIN: can edit their own prefs and set defaults for STAFF/VIEWER.
- STAFF/VIEWER: can only edit their own non-mandatory preferences.

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
- **Super Admin impersonation**: Super Admin can temporarily act as a tenant user (log in as them) for support and debugging purposes. Issues a short-lived impersonation JWT signed with `sub: targetUserId, impersonatedBy: adminId`. All audit log entries created during an impersonation session are tagged with `actorType: IMPERSONATED`. Requires a dedicated UI in the admin panel and an explicit exit-impersonation flow.

**Why deferred:** Current Super Admin model (boolean `isPlatformAdmin`) is sufficient for MVP. Cross-tenant relationships need product design before engineering. Impersonation requires careful audit trail design before implementation — must not be added without full logging.

---

## Post-MVP: i18n + Currency (after MS8)

The app should support multiple languages and currencies from the settings layer — not hardcoded to one locale.

### What this covers

- **Language switcher** — App-wide UI language. Affects labels, error messages, date formats, number formats.
- **Currency switcher** — Display currency for prices, order totals, payment amounts. Does not change the stored value (`priceCents` stays in cents, conversion is display-only until multi-currency pricing is introduced).

### Settings levels

| Level | Scope | Where set |
|---|---|---|
| Tenant default | Applies to all staff who haven't set a personal override | Settings → Tenant Profile |
| Per-staff override | Individual preference, overrides tenant default | User profile / account settings |
| Per-end-user (future) | Customer locale for marketplace UI | Phase 7 customer profile |

### Schema additions (when this ships)

- `Tenant`: add `locale: String` (e.g. `"en"`, `"fil"`, `"zh"`) and `currency: String` (e.g. `"PHP"`, `"USD"`, `"SGD"`). Defaults to `"en"` / `"PHP"`.
- `User`: add `locale: String?` and `currency: String?` — null means "use tenant default."

### Implementation notes

- Use `react-i18next` (Next.js) + `i18next` for translation strings.
- Currency display uses `Intl.NumberFormat` — no extra library needed.
- Translation files per locale in `apps/web/public/locales/`.
- First supported locale: `en`. Second: `fil` (Filipino). Expand as needed.
- All `priceCents` values remain stored as integers. Currency conversion for display only until multi-currency SKU pricing is a real need.

**Why deferred:** MS8 replaces all scaffolding with production UI. Wiring i18n before the UI is final means double work. Add after MS8 UI is stable.

---

## Post-MVP: Platform Integrations — Centralized Inventory Hub (after MS8)

### Vision

This platform becomes the single source of truth for a tenant's inventory across all selling channels. If a sale happens on Shopee, Lazada, a physical POS, or a custom supplier system, the inventory count in this dashboard updates in real-time.

### How it works

- Each integration is a **feature-flagged connector** — disabled by default, enabled per tenant by Super Admin.
- Connectors listen for webhook events (or poll) from the external platform and create `InventoryMovement` records (`type: OUT`, `referenceType: INTEGRATION`, `referenceId: <external_order_id>`).
- `stockOnHand` is always derived from movements — the integration just adds a new source of movements. No special-casing in the core model.
- PBAC-controlled: only users with a new `can_manage_integrations` permission can configure or view integration settings.

### Planned integrations (in rough priority order)

| Integration | Type | Notes |
|---|---|---|
| Shopee | E-commerce platform | Webhook-based order events |
| Lazada | E-commerce platform | Webhook-based order events |
| Custom supplier/distributor API | Private system | Configurable webhook endpoint; covers B2B supplier inventory sync (e.g. brother's distribution business) |
| Courier APIs (J&T, LBC, Ninja Van) | Logistics | Delivery status sync to order updates — secondary priority |

### Schema additions (when this ships)

- `Integration` table: `id`, `tenantId`, `type` (enum), `config` (JSONB — API keys, webhook URLs, etc.), `isActive`, `createdAt`.
- `InventoryMovement.referenceType` enum: add `INTEGRATION` value.
- `IntegrationEvent` log table (append-only): `id`, `integrationId`, `payload` (JSONB), `processedAt`, `status` (`OK` / `FAILED`).

### Feature flags

- New flag: `integrations: false` by default. Super Admin enables per tenant.
- Sub-flags per connector type can be added later if needed.

### PBAC additions

- New permission: `can_manage_integrations` — configure integration credentials, enable/disable connectors.
- New permission: `can_view_integration_log` — view the integration event history.
- Defaults: OWNER gets both. ADMIN gets view only. STAFF/VIEWER: none.

**Why deferred:** Core ERP must be stable before adding external dependencies. Integration reliability, webhook security (signature verification), and retry logic add significant complexity. Scope for a dedicated phase after marketplace discovery.

---

## Post-MVP: Custom Roles (after MS8)

Currently roles are fixed: OWNER, ADMIN, STAFF, VIEWER. Custom roles allow tenants to create named role presets that fit their org structure (e.g. "Warehouse Staff", "Sales Rep").

### Design

- `TenantRole` table: `id`, `tenantId`, `name`, `basedOn` (enum — the base role it inherits from), `permissions` (JSONB — overrides on top of the base role's defaults), `createdAt`.
- Custom roles behave like named snapshots of a permission set. They do not form a hierarchy — all derive from one of the four base roles.
- Displayed in the PBAC UI as a collapsible tree: base role → custom roles under it.
- Assigning a custom role to a membership sets `role = basedOn` and applies the `permissions` JSONB as overrides (same mechanism as per-member overrides, just pre-saved).
- **Guard:** a custom role cannot be deleted if any active membership references it. Must reassign members first.
- **Copy/duplicate role:** creates a new `TenantRole` with the same `basedOn` + `permissions` — rename and adjust from there.

### UI additions

- Settings → Team & Permissions → new **Roles** tab action: "Create custom role" (OWNER only).
- Custom role rows appear under their base role in the Roles tab tree.
- When inviting or editing a member, custom roles appear in the role dropdown alongside base roles.

**Why deferred:** The per-member permission override system (shipping in MS8) covers 90% of the use case. Custom roles are a convenience feature for tenants with many staff in identical configurations. Add after MS8 PBAC UI is validated with real users.

---

## Known Engineering Challenges

These are documented to inform future milestone planning — not blockers for MS8.

| Challenge | Impact | Mitigation |
|---|---|---|
| **Permission drift** | Staff accumulate custom overrides; changing their role later may leave conflicting overrides. | Add "reset to role default" action in PBAC UI (MS8). |
| **Privilege escalation** | ADMIN must not grant STAFF permissions exceeding ADMIN's own ceiling. | Guards validate acting user's scope, not just target role. |
| **Role deletion guard** | Custom role can't be deleted if active members are assigned to it. | Block delete endpoint + show reassignment prompt in UI. |
| **JWT token lag** | Deactivating a membership or changing permissions takes effect at next login (24h JWT). | Check `membership.status` on every protected request, not just at token issue. |
| **Messenger / WhatsApp template constraint** | Meta only allows free-form messages within a 24h reply window. Arbitrary event notifications need pre-approved templates outside that window. | Register message templates per notification type before launch. |
| **Low stock alert spam** | If stock hovers at threshold (movement in, movement out, repeat), `stock.low` fires on every OUT. | Add cooldown per SKU (e.g. max one alert per 6h) or a `lastAlertedAt` field. |
| **Render cold starts** | Free tier spins down after ~15min idle. First request after idle takes 10–30s. | Document for testing; upgrade to Render Starter ($7/mo) before real users. |
| **Neon connection exhaustion** | Prisma opens a connection per request. Neon free tier has a low ceiling. | Add PgBouncer or Prisma Accelerate before any production load. |
| **Concurrent order confirmation race** | Two simultaneous CONFIRM requests both pass the stock check before either deducts. | Mitigated by Prisma `$transaction` wrapping stock check + decrement. Document explicitly in code. |
| **Integration webhook security** | External platforms (Shopee, Lazada) must authenticate their webhook payloads. | Verify HMAC signatures on all incoming webhook requests. Never trust payload without verification. |

---

## Post-MVP: AI Chatbot + RAG (after marketplace or parallel track)

AI features are a natural fit for this platform — tenants already have structured operational data (inventory, orders, payments) that can power intelligent assistants.

### Planned AI surfaces

**1. In-app staff chatbot (post-MS8)**
- Chat widget in the tenant dashboard sidebar or bottom-right corner.
- Staff can query their own data in natural language: "What's the stock on Bolt M8?", "Show me unpaid orders this week", "Which SKUs are running low?"
- Strictly tenant-scoped — the chatbot only ever sees data belonging to `tenantId`. The existing isolation model is already correct.
- Stack: Claude API (`@anthropic/sdk`) + pgvector on Neon for embeddings (RAG over tenant data).
- Feature-flagged: `features.ai_chatbot` — enabled per tenant by Super Admin.

**2. Marketplace product discovery chatbot (Phase 7)**
- Customer-facing: "I need 3mm fasteners under ₱50", "Find flour suppliers near me."
- RAG over published `MarketplaceListing` + `Product` + `Category` data.
- Cross-tenant but read-only public data — no inventory or financial data exposed.

**3. Operational AI (later)**
- Reorder suggestions: "SKU X has 2 units left and typically sells 5/week — time to reorder."
- Demand forecasting from `InventoryMovement` history.
- Anomaly detection: unusual stock deductions, payment pattern changes.
- These require enough historical data to be useful — relevant after real tenants have 3–6 months of activity.

### Architecture notes

- All AI queries are tenant-scoped at the service layer — no special AI isolation needed beyond what already exists.
- pgvector is available as a Neon extension — no separate vector DB needed at this scale.
- Claude API (Anthropic) is the LLM of choice. Model: claude-haiku-4-5 for fast chatbot responses, claude-sonnet-4-6 for complex analysis.
- RAG pattern: embed tenant data on write (InventoryMovement, Order created events) → store in pgvector → retrieve on chat query → pass to Claude with tenant context.
- `REPLICATE_API_TOKEN` already in env for image generation. `ANTHROPIC_API_KEY` will be added when AI ships.
- Feature flag: `features.ai_chatbot` on Tenant — Super Admin enables per tenant.

**Why deferred:** Requires stable data model and real tenant data to be useful. Build after MS8 when the ERP foundation is solid.

---

## Future Phases (DO NOT IMPLEMENT YET)

The ERP foundation (MS1–MS8) comes first. These phases are real goals — they are sequenced after the core platform is stable, not abandoned.

| Phase | Scope |
|---|---|
| Phase 5 | Mobile app (React Native / Expo) — staff-focused, offline-first |
| Phase 6 | POS + Barcode scanning (mobile-based, uses Orders + Payments) |
| Phase 7 | **Marketplace** — see full design below. |
| Phase 8 | AWS scaling — ECS, RDS, S3, CloudFront, **subdomain routing per tenant** (e.g. `acme.yourplatform.com`). If traffic demands it, migrate to EKS — a decision driven by real load data, not preemptive. |

If a feature belongs to Phase 5+, do NOT implement now. Document it and assign to the appropriate future phase.

---

## Phase 7 — Marketplace (Full Design)

The marketplace is a long-term goal, not an afterthought. ERP comes first so tenants have real operational data (inventory, orders, payments) before they open a storefront. The marketplace is built on top of that foundation — same inventory, same order system, same payment flow.

### Two entry points, one inventory truth

**Global marketplace** — customers land on the main storefront and search/browse across all tenants. Filter by keyword, category, price range, tenant/brand, or custom attributes. Products from multiple tenants appear side by side.

**Per-tenant storefront** — customers navigate to a specific business (e.g. `/shop/peak-hardware`). Only that tenant's published listings are visible. Same products, same inventory — just scoped to one seller.

Both views pull from the same `MarketplaceListing` + `Sku` data. No duplication.

### Routing

```
/marketplace                    → global browse (all tenants)
/marketplace/search?q=...       → search results across tenants
/marketplace/category/:slug     → category-filtered browse
/shop/:tenantSlug               → per-tenant storefront
/shop/:tenantSlug/products/:id  → product detail page
```

### Staff side — listing management

- Staff with `can_manage_listings` permission publish/unpublish SKUs to the marketplace.
- `MarketplaceListing` record opts a SKU in. Can have its own `marketplacePrice` (different from internal `priceCents` — e.g. sell wholesale internally, retail on marketplace).
- Feature-flagged: only tenants with `marketplace: true` can list. Controlled by Super Admin.
- Archived SKUs (`isArchived: true`) cannot be listed.

### Customer side — browse + buy

- Customer auth is separate from staff auth. `CustomerProfile` is NOT a `TenantMembership`. One global customer account — can order from any tenant.
- Browse → Product Detail → Add to Cart → Checkout → Payment → Order confirmation.
- Cart supports multi-tenant line items (items from Peak Hardware + Corner General in one cart).
- At checkout, cart splits into separate orders per tenant. Each tenant fulfills their own orders independently.
- Customer sees grouped order summary: "Order from Peak Hardware", "Order from Corner General".

### Multi-tenant cart → split orders

This is the most complex piece. Design:

1. `Cart` + `CartItem` records scoped to `customerId`. `CartItem` references `marketplaceListingId` + `skuId` + `tenantId`.
2. At checkout, `CartItem` rows are grouped by `tenantId`.
3. One `Order` created per tenant group (reuses existing `Order` + `OrderItem` model).
4. Each order is confirmed independently — tenant staff process their own orders.
5. Payment: one checkout transaction to the customer, split per order behind the scenes (payment gateway handles this).

### Payment gateway — hard dependency for Phase 7

Manual verification won't scale for customer-facing checkout. Phase 7 requires a real payment gateway.

| Gateway | Market | Priority |
|---|---|---|
| PayMongo | PH | First — local payment methods (GCash, Maya, cards) |
| Stripe | Global | Second — international cards |

Gateway responsibilities: charge customer, split funds per tenant order, handle webhooks (payment confirmed/failed), refund flow.

### Search

| Stage | Technology | When |
|---|---|---|
| Launch | Postgres full-text search (`tsvector`) | Sufficient for early scale |
| Growth | Meilisearch or Typesense | When Postgres FTS shows latency under load |
| Scale | Elasticsearch | Hyperscale — likely post-Phase 8 |

### Inventory concurrency at marketplace scale

Same race condition as order confirmation — two customers buying the last item simultaneously. Same mitigation: Prisma `$transaction` wrapping stock check + decrement. At high traffic, add optimistic locking or a queue per SKU.

### New permissions for Phase 7

| Permission | Who | What |
|---|---|---|
| `can_manage_listings` | OWNER, ADMIN | Publish/unpublish SKUs to marketplace |
| `can_view_marketplace_orders` | OWNER, ADMIN, STAFF | See marketplace-originated orders |

### Notifications for marketplace events

| Event | Who notified |
|---|---|
| `marketplace.order_received` | Tenant OWNER + ADMIN |
| `marketplace.payment_confirmed` | Tenant OWNER |
| `marketplace.order_cancelled` | Tenant OWNER + ADMIN |

### Data model additions (Phase 7)

See DATA_MODEL.md → Future Models for full field lists:
- `CustomerProfile` — customer auth, separate from TenantMembership
- `Cart` + `CartItem` — multi-tenant aware, scoped to customer
- `MarketplaceListing` — opts a SKU into the marketplace, optional price override
- `MarketplaceOrder` — or reuse `Order` with a `source: MARKETPLACE | INTERNAL` field (decision at Phase 7 start)
