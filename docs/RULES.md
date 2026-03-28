# Rules

This is the living rulebook for building this platform. All contributors must follow these rules strictly.

> Last updated: 2026-03-28 — Realigned to ERP-lite modular platform. Added scope control system,
> inventory safety rules, feature flag rules, PBAC rules, and businessType rules.

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
| FUTURE FEATURE | Belongs to Phase 5+ (mobile, POS, marketplace, AWS) | DO NOT IMPLEMENT |

If not MVP-CRITICAL → document it, assign to the appropriate future phase, do not build.

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

**MVP EXCLUDES (prohibited — DO NOT BUILD):**

- Mobile app (React Native / Expo)
- Offline support
- POS system
- Barcode scanning workflows
- Marketplace / customer-facing UI
- Advanced reporting or analytics
- Automation systems
- Accounting features
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

- Roles (OWNER, ADMIN, MEMBER, VIEWER) define default permission bundles.
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
- Testing is UI + API only. API tests are run by Claude. UI tests are done by the user.
- **API tests are Claude's responsibility.** Write and run E2E tests (Jest + Supertest) — do NOT use curl for API testing. Curl wastes tokens and is not reusable. Run `pnpm --filter api test:e2e` and report pass/fail before asking the user to commit.
- Every new API endpoint requires an E2E test covering: happy path, validation error, tenant isolation (cross-tenant 403), and invalid transitions where applicable.
- Shared test helpers live in `apps/api/test/helpers/`. Use `createTestApp()` and `loginAs()` for all E2E tests.
- **UI tests are the user's responsibility.** Provide exact browser steps + expected outcome for each step.
- Every test must include its **expected result** — never list a test step without saying what success looks like.
- If any E2E test fails, diagnose and fix before surfacing to user. Do not commit broken code.
- **Run the seeder automatically** (`pnpm db:seed`) whenever a migration or seed change is made — do not ask the user to run it.

---

## E2E Test Rules

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

See `docs/DEVELOPMENT.md` for how to run tests locally.

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

## Authentication Roadmap

LATER (not MVP unless explicitly pulled in):

- OAuth/OIDC social login (Google, Facebook/Meta).
- Keep auth design compatible with multiple identity providers.
- Do not block MVP on social login — email/password only for now.
