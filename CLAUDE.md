# CLAUDE.md — Project Instructions for Claude Code

This file is read automatically by Claude Code at the start of every session.

---

## Stack

- **API:** NestJS (apps/api) — port 3001
- **Web:** Next.js 14 App Router (apps/web) — port 3000
- **DB:** Prisma + Neon Postgres (packages/db)
- **Shared:** TypeScript utilities and feature registry (packages/shared)
- **Package manager:** pnpm (workspace)

Run everything from repo root: `pnpm dev`

---

## Multi-Tenant Architecture

Every API request requires:
- `x-tenant-slug` header → resolved by `TenantGuard` → `req.tenant`
- `x-branch-id` header (optional) → branch-scoped operations

`apiFetch()` in the web app auto-sends both headers from localStorage.

---

## Feature Flags

Documented in `docs/FEATURE_FLAGS.md`. The 4 layers are:
1. `PLATFORM_FEATURES` in `packages/shared/src/features.ts` — master registry
2. `Tenant.features` JSON column — per-tenant toggles
3. `FLAG_KEYS` in `apps/web/src/app/admin/page.tsx` — admin UI
4. Guard at usage point (`@RequireFeature` decorator or inline check)

When adding a new flag, update all 4 layers.

---

## Plan Limits

Numeric per-tenant controls (distinct from feature flags):

| Field | Default | Admin endpoint |
|-------|---------|---------------|
| `Tenant.maxBranches` | 1 | `PATCH /admin/tenants/:id/limits` |

Branch creation is guarded in `branches.service.ts`: flag `multipleBranches` must be `true` AND `branchCount < maxBranches`.

---

## Git & PR Workflow

Use **`gh` CLI** for all PR operations (not the GitHub web UI):

```bash
# Create PR
gh pr create --title "feat: ..." --body "$(cat <<'EOF'
## Summary
- bullet points

## Test plan
- [ ] manual steps

🤖 Generated with Claude Code
EOF
)"

# Merge (squash) + delete remote branch — ONLY after user says "merge" / "lgtm" / "go"
gh pr merge --squash --delete-branch

# After merge: sync and clean local
git checkout main && git pull
git branch -d feat/your-feature
```

### PR merge rule — STOP after `gh pr create`

**Never merge a PR immediately after creating it.**

The flow is:
1. Push branch + `gh pr create` → return the PR URL
2. **Stop. Wait.** The user tests the feature locally first.
3. Only run `gh pr merge` when the user explicitly says to merge (e.g. "merge it", "lgtm", "go ahead", "merge #71").

Merging before the user tests wastes a revert cycle if the UI is broken or incomplete.

Branch naming: `feat/`, `fix/`, `chore/`, `docs/`

---

## Database

- Local: Docker Postgres on port 5442 (`pnpm infra:up`)
- Staging/Prod: Neon (connection string in `.env.staging`)
- Reset local: `pnpm db:reset` (destructive — dev only)
- Migrations: `pnpm db:migrate` (always run from repo root)

**Seeder accounts** (after `pnpm db:seed`):

| Email | Password | Role |
|-------|----------|------|
| `admin@local.test` | from `ADMIN_PASSWORD` | Platform Admin |
| `owner@peak-hardware.test` | `Password123!` | OWNER |
| `owner@metro-pizza.test` | `Password123!` | OWNER |
| `owner@corner-general.test` | `Password123!` | OWNER |

All staff accounts use `staff@<tenant>.test` / `Password123!`

---

## UI/UX Standards

All UI work must be **clean and modern**:
- Prefer minimal, low-noise layouts — show only what's needed at a glance
- Use collapsible / progressive disclosure for dense information (e.g. admin cards collapsed by default)
- Rounded corners (`rounded-xl`), subtle shadows, muted backgrounds for secondary areas
- Dot status indicators over label-only badges
- Avoid ALL CAPS section labels — use visual hierarchy instead
- Spacing: generous padding, consistent gap scale

---

## Key Conventions

- `tenantId` is always a UUID — never use slug as a FK
- `stockOnHand` on `Sku` = global tenant total (fast reads)
- Per-branch stock = derived from `InventoryMovement` via `getBranchStock()`
- `isSystem: true` tenants (Admin Tenant) are filtered from admin panel lists
- All money values are in **cents** (integer). Display with `formatCents()`
- Soft-delete pattern: `isArchived: true, isActive: false` — history preserved

---

## Docs index

| File | Purpose |
|------|---------|
| `docs/FEATURE_FLAGS.md` | Feature flag system + plan limits |
| `docs/ARCHITECTURE.md` | System design |
| `docs/DATA_MODEL.md` | Prisma schema walkthrough |
| `docs/DEVELOPMENT.md` | Local setup, commands, PR workflow |
| `docs/DEPLOYMENT.md` | Render / Vercel / Neon deploy guide |
| `docs/MILESTONES.md` | Product roadmap and milestone history |
