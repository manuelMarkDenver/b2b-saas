# Rules

This is the living rulebook for building this platform. All contributors must follow these rules strictly.

> Last updated: 2026-03-30 — Confirm-before-act rule strengthened. Tenant self-registration removed (no pricing model yet — demo-only via Calendly). Pre-staging checklist updated. Multi-branch v1 + marketing page pulled forward.

---

## ⛔ Confirm-Before-Act Rule (Absolute — No Exceptions)

Before making **ANY** change — code, docs, migrations, config, memory files — Claude must:

1. **State the action plan in plain text** — what will change, which files, why.
2. **Wait for explicit user confirmation** ("yes", "go ahead", or equivalent).
3. **Only then execute.**

**This rule has been violated before. It must not be violated again.**

- Applies to ALL changes — including "obvious" ones, docs-only updates, and memory writes.
- Applies even mid-task. If scope shifts unexpectedly, stop and confirm the new direction.
- Confirmation is per-task, not a blanket. Agreeing to fix bug A does not authorize fixing bug B.
- **Wasted tokens from unwanted changes cost more than the few tokens spent confirming.**

The goal: the user never has to undo something Claude did without asking.

---

## 0. Non-Negotiable Principles

1. Build in phases. Do NOT skip ahead.
2. MVP first. Future features are strictly prohibited unless explicitly allowed.
3. Backend is always the source of truth.
4. Multi-tenant isolation must NEVER be broken.
5. Inventory integrity must NEVER be compromised.
6. Every change must update documentation.
7. If a feature is not MVP-CRITICAL → DO NOT IMPLEMENT.

---

## Scope Control System

Every proposed change must be classified before implementation:

| Class | Definition | Action |
|---|---|---|
| MVP-CRITICAL | Required for the system to function at its current phase | IMPLEMENT |
| MVP-ENHANCEMENT | Improves UX/DX but not required for DoD | DEFER — ask user first |
| PRE-STAGING | Required before first real client touches staging | IMPLEMENT before deploy |
| PHASE 5 | CSV Import (MS9 ✅), Multi-Branch v1 (pulled into pre-staging) | BUILD NOW (multi-branch) |
| PHASE 6 | Marketing Website (MS11) — pulled forward, build before staging | BUILD NOW |
| PROHIBITED | Mobile, POS, Marketplace, AWS Scale (Phase 7–9) | DO NOT IMPLEMENT |

**PRE-STAGING items (in order):**
1. Staff password change + negative stock floor + `customerRef` on orders (MS9 close)
2. Marketing page (`apps/marketing`) — local first; CTA = "Request a Demo" → Calendly (no self-registration)
3. Multi-branch v1 — scaffolded, invisible at single-branch
4. Dashboard / home screen — summary view on login
5. Staging deployment

**No tenant self-registration.** There is no pricing model and no tiers yet. All tenants are manually provisioned by Super Admin. Prospects book a demo via Calendly; owner onboards them.

If not MVP-CRITICAL → document it, assign to the appropriate future phase, do not build.

**Phase reference:** See `docs/MILESTONES.md` Phase Map for the full phase-to-milestone breakdown.

Use `/scope-check <feature>` to classify any proposed addition before touching code.

---

## MVP Boundary (Phase 1–4)

**MVP INCLUDES:**

- Authentication (email/password)
- Tenant creation (Super Admin only)
- Tenant memberships and roles
- Product + SKU management (with `costCents`)
- Inventory movement logging
- Orders system
- Payments (manual verification only)
- Feature flags (enable/disable modules per tenant)
- Basic Super Admin dashboard

**PHASE 5 — Planned, not yet buildable (MS9–MS10):**

- CSV import for products, inventory, orders
- Multi-branch inventory and staff assignment

**PROHIBITED — DO NOT BUILD (Phase 7–8, requires explicit product decision):**

- Mobile app (React Native / Expo) 🚫
- Offline support 🚫
- POS system 🚫
- Barcode scanning workflows 🚫
- Marketplace / customer-facing UI 🔒
- AWS Scale + Subdomain Routing 🔒

**NOT IN MVP (defer to appropriate phase):**

- Advanced reporting or analytics
- Automation systems
- Accounting features
- Payroll module 🔒 (Post-Phase 5 — requires explicit product decision)
- Payment gateway integrations (Stripe, PayMongo, etc.)
- Self-serve tenant signup

---

## Multi-Tenant Rules

- Every row is explicitly owned by either the platform or a tenant.
- Tenant ownership is represented by `tenantId` (UUID) on all tenant-owned tables.
- Platform-owned tables have no `tenantId` (e.g., `Category`).
- `tenantId` must NEVER come from client input (body, params, query). Always derive from authenticated session + membership check.
- Never infer tenant from user without explicit membership checks.
- All service methods on tenant-owned resources must include `tenantId` in the `where` clause.
- Run `/tenant-audit` before merging any PR that touches service files.

---

## Order Mutability Rules

- Orders are **immutable once confirmed**. Only `PENDING` orders may be edited.
- Editing an order (`PATCH /orders/:id`) replaces all items and recalculates the total in a single transaction.
- Attempting to edit a non-PENDING order returns `400 Bad Request`.
- After `CONFIRMED`: no edits. To correct a confirmed order, cancel it and create a new one.
- `priceAtTime` on `OrderItem` is always captured at the moment the item is saved (create or edit) — never updated retroactively.
- Audit log must emit `order.updated` on every successful edit.

---

## Inventory Safety Rules

- `stockOnHand` on `Sku` must NEVER be mutated directly.
- Every stock change MUST create an `InventoryMovement` record first.
- No silent stock updates — backend enforces this without exception.
- `InventoryMovement` types: `IN`, `OUT`, `ADJUSTMENT`.
- `referenceType` must be set: `ORDER` (automated) or `MANUAL` (staff action).
- Negative stock prevention is optional in MVP — can be added in MS8 hardening.

---

## Feature Flag Rules

- Feature flags are stored in `Tenant.features` as JSONB.
- Flags: `inventory`, `orders`, `payments`, `marketplace`.
- Controlled by Super Admin only — never by tenant staff or frontend directly.
- All feature-gated routes must check the relevant flag via a guard.
- Feature flags must NOT be hardcoded in business logic.
- `marketplace` flag is stored now but its UI is not built until Phase 7.

---

## Business Type Rules

- `businessType` allowed values: `general_retail`, `hardware`, `food_beverage`, `packaging_supply`.
- Used ONLY for setting default feature flags when a tenant is created.
- Must NOT control any business logic, routing, or behavior after tenant creation.
- Do NOT add industry-specific logic to any module.

---

## PBAC Rules

- Roles (OWNER, ADMIN, STAFF, VIEWER) define default permission bundles.
- Permissions can be overridden per membership without changing the role definition.
- Do NOT hardcode role logic in business logic (e.g., `if role === 'ADMIN'`).
- Use permission guards that read capabilities from membership.
- Adding new capabilities must not require role changes.

---

## Documentation Requirements

Every change MUST update the relevant docs before the PR is merged:

| Change Type | Docs to Update |
|---|---|
| New model / schema change | `DATA_MODEL.md` |
| New module / surface / flag | `ARCHITECTURE.md` |
| Milestone DoD change | `MILESTONES.md` |
| New rule / constraint | `RULES.md` |

No change is complete without documentation. Use `/ms-done <n>` to verify before closing a milestone.

---

## Git Workflow Rules

MUST:

- Do all work on a new branch and merge to `main` via PR.
- Keep `main` green (lint/typecheck/tests passing) before merge.
- Multiple PRs per milestone are allowed — docs changes and implementation changes go in separate PRs.
- Start new branches from an up-to-date `main` unless intentionally stacking PRs.
- Do not branch from another feature branch unless you want to carry its commits.

SHOULD:

- Use branch prefixes: `milestone-<n>/...`, `feat/...`, `fix/...`, `chore/...`, `docs/...`.
- Squash merge PRs to keep history readable.

---

## Commit and Push Workflow

This is the standard workflow for every change:

1. **Claude implements** the change.
2. **Claude runs API tests** — reports results with expected vs actual.
3. **User tests UI** (if applicable) — Claude provides exact steps and expected outcomes.
4. **User gives go signal** — explicit confirmation before any commit.
5. **Claude commits and pushes** — with a clear commit message, no co-author line.
6. **User merges** on GitHub via PR.
7. **User confirms merge** — Claude uses this as the signal to proceed to the next task.

MUST:

- Never commit or push without explicit go signal from the user.
- Never merge — user handles all merges on GitHub.
- After user confirms a merge, treat `main` as updated and branch from it for the next task.
- Doc updates that are directly related to the current branch's work go in the same branch and PR — do NOT create a separate branch just for docs. Only create a separate docs branch when the doc change is standalone (e.g., a rules update unrelated to any implementation).

---

## Milestone Execution Rules

MUST:

- Before starting a new milestone: re-read `docs/MILESTONES.md`, restate the DoD, and propose a concrete plan.
- Explicitly confirm the plan with the user before writing code.
- If anything is ambiguous (scope, approach, data model): ask first, then act.
- If a change affects milestone scope: update `docs/MILESTONES.md` first (docs PR), then implement.

---

## Enhancement Categorization

Any proposed improvement during milestone work must be categorized as:

- `DoD-required`: necessary to meet the milestone DoD or fix a bug introduced by milestone work → IMPLEMENT.
- `Milestone-adjacent`: improves usability but not required for DoD → ask the user first.
- `Later`: out of scope → record and defer to appropriate future phase.

---

## Seed Data Rules

MUST:

- Seed 3 realistic businesses: hardware store, food supplier (pizza supplies style), retail shop.
- Include realistic products, SKUs (with `costCents`), inventory movements, orders, and payments.
- When seed data changes, remind the user to re-run `pnpm db:seed` (and `pnpm db:migrate` if a migration is included).

---

## Quality Loop Rules

MUST:

- After making a behavior change (API or web), testing is required before committing.
- **API tests are Claude's responsibility.** Write and run E2E tests (Jest + Supertest) — do NOT use curl for API testing. Curl wastes tokens and is not reusable. Run `pnpm --filter api test:e2e` and report pass/fail before asking the user to commit.
- Every new API endpoint requires an E2E test covering: happy path, validation error, tenant isolation (cross-tenant 403), and invalid transitions where applicable.
- Shared test helpers live in `apps/api/test/helpers/`. Use `createTestApp()` and `loginAs()` for all E2E tests.
- **UI spot-check is the user's responsibility.** Claude provides exact browser steps + expected outcome for every UI change.
- Every test must include its **expected result** — never list a test step without saying what success looks like.
- If any test fails, diagnose and fix before surfacing to user. Do not commit broken code.
- **Run the seeder automatically** (`pnpm db:seed`) whenever a migration or seed change is made — do not ask the user to run it.

---

## E2E Test Rules (API)

MUST:

- Every new API endpoint requires an E2E test (Jest + Supertest) before the PR is merged.
- E2E tests live in `apps/api/test/` — one file per module (e.g., `orders.e2e-spec.ts`).
- Shared setup helpers live in `apps/api/test/helpers/app.helper.ts` — use `createTestApp()` and `loginAs()`.
- Run with: `pnpm --filter api test:e2e`
- E2E tests must use a real database — no mocked Prisma.
- Test at minimum: happy path, tenant isolation (cross-tenant 403), and one validation error.
- Complex business logic (e.g., delta calculation, status transitions) gets unit tests in addition to E2E.
- Do NOT write E2E tests that mock the service layer — they must go through the full HTTP stack.
- Do NOT use curl for API verification — always use E2E tests instead.

---

## API Conventions

- REST only.
- Consistent JSON error shape.
- UUIDs for all identifiers.
- No PII or secrets in logs.
- All tenant-scoped endpoints derive `tenantId` from auth context, never from request body/params.

---

## Frontend Rules

- Tenant-scoped routes: `/t/:tenantSlug/...`
- Super Admin routes: `/admin/...`
- No public marketplace routes in MVP.
- Tenant branding is token-driven (CSS variables + tenant settings) — not hardcoded.
- Support light/dark mode via `next-themes`.
- No custom domains in MVP.

---

## Image Rules

MUST:

- All images committed to the repo must be optimized. Run `/optimize-images` before any PR that includes new image assets.
- Use WebP format for all product and UI images — 25–35% smaller than JPEG at equivalent quality.
- Use the Next.js `<Image>` component (not raw `<img>`) for all images in the web app — handles lazy loading, format negotiation, and resizing automatically.
- Maximum image dimensions: 1200×900 for product images, 1200×630 for OG/social images.
- Target file size: ≤150KB per image after optimization.

SHOULD:

- Use the `/generate-image` skill to generate AI product images (FLUX Schnell via Replicate). Requires `REPLICATE_API_TOKEN` in env.
- Use the `/optimize-images` skill to batch-optimize existing images before deployment.
- Store product/UI images in `apps/web/public/images/` with a clear subfolder structure (e.g. `products/`, `ui/`, `generated/`).
- Prefer AI-generated placeholder images over lorem picsum or generic stock photos for product demos.

- If the backend does not provide an image URL yet, render a deterministic default thumbnail (so lists remain scannable without introducing storage/upload scope).

- For ERP-style workflows, prefer list views (table/cards) that open a focused detail view (right-side sheet) for actions; keep destructive/state-change actions inside the detail view to reduce mis-clicks.

- In order detail sheets/drawers, show item thumbnails prominently. For multi-item orders, render a list of items with thumbnails and put the total + primary action (e.g. submit payment) in a bottom footer.

- When introducing new list UIs, confirm whether the backing endpoint is paginated. If it is, implement pagination (or explicit limits + sorting) in the UI so behavior stays consistent across modules.

- Avoid mixing multiple primary workflows in a single view (e.g. payables + payment history). If both are needed, use tabs or separate routes.

- **Table layout standard (MS8+):** All list panels use a consistent grid layout — header row with uppercase labels, ProductThumb in the first column, status badges (Badge component with min-width + justify-center), monospaced amounts, and a contextual text action in the last column. Clickable rows open a right-side Sheet for detail/actions.

- **New Order UX (MS8+):** Multi-item orders are created via a Sheet with a Shopee-style 2-column product grid (aspect-square images, per-card quantity controls), a cart summary section at top, and a sticky footer with large total text (text-3xl font-bold) + Place Order CTA. No dropdown-only pickers for product selection.

- **ProductThumb `fill` prop:** When rendering product images in a responsive grid (cards), use `fill` mode with a parent `aspect-square relative` container. For fixed-size thumbnails in table rows, use the `size` prop (40px in rows, 72–80px in detail sheets).

MUST NOT:

- Commit unoptimized PNG/JPEG images directly — always convert to WebP first.
- Store large images (>500KB) in the repo.
- Use `<img>` tags directly in Next.js components — always use the `<Image>` component.

---

## Image Upload Infrastructure Rules

### Storage backend

- `STORAGE_TYPE=local|s3` switches the upload backend. Default: `local`.
- **Local**: files saved to `apps/api/uploads/`, served via `express.static` at `/uploads/*` in `main.ts`. URL: `${APP_BASE_URL}/uploads/${filename}`.
- **S3**: `PutObjectCommand` via `@aws-sdk/client-s3`. Public URL: `${AWS_S3_PUBLIC_URL}/${key}`. Required env vars: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_S3_PUBLIC_URL`.

### Static file serving

- **MUST use `express.static` in `main.ts`** — NOT `ServeStaticModule` in the NestJS module tree.
- `ServeStaticModule` breaks `createTestApp()` in E2E tests (startup fails). Never add it to any module.
- The `express.static` middleware in `main.ts` is not loaded during tests, so it does not affect test runs.

### Upload controller rules

- All uploads require `JwtAuthGuard` — no anonymous uploads.
- Max file size: 5MB. Accepted MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.
- Multer uses `diskStorage` locally. For S3, the file is written to disk first, then streamed to S3 — the local file is not retained.
- `x-tenant-slug` header is required and forwarded from the frontend for tenant context.

### Entity image URL fields

- `Sku.imageUrl`: ✅ implemented (migration `20260329061213_add_sku_image_url`).
- `Tenant.logoUrl`: ✅ implemented (migration `20260329300000_add_avatar_logo_url`). `PATCH /tenant/logo` (OWNER/ADMIN only).
- `User.avatarUrl`: ✅ implemented (same migration). `PATCH /auth/me` to update.
- `SuperAdmin` profile image: deferred to MS9.

### Image cropping

- Deferred to MS9 (Milestone-adjacent). When implemented, use a client-side cropper (e.g. `react-easy-crop`) before upload — do not crop server-side.

---

## Authentication Roadmap

LATER (not MVP unless explicitly pulled in):

- OAuth/OIDC social login (Google, Facebook/Meta).
- Keep auth design compatible with multiple identity providers.
- Do not block MVP on social login — email/password only for now.

---

## PR Workflow (Required Steps Before Every Merge)

Every PR must complete these steps **in order** before merging:

| Step | Action | Required |
|------|--------|----------|
| 1 | All E2E tests pass (`pnpm --filter api test:e2e`) | ✅ Mandatory |
| 2 | TypeScript compiles clean (`pnpm typecheck`) | ✅ Mandatory |
| 3 | Run `/audit` — no 🔴 findings allowed to remain | ✅ Mandatory |
| 4 | User manual UI test (Claude provides step-by-step checklist) | ✅ Mandatory |
| 5 | User gives explicit go signal | ✅ Mandatory |
| 6 | Claude commits + pushes | ✅ Mandatory |
| 7 | User merges on GitHub | ✅ Mandatory |

**On `/audit` findings:**
- 🔴 Blocking → fix before merge, no exceptions
- 🟡 Warning → document in PR description, fix before staging
- 🟢 Advisory → log in MILESTONES.md backlog, fix when convenient
