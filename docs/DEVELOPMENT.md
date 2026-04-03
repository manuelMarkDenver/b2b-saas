# Development Guide

This document covers how to run, migrate, seed, and test the platform locally.

---

## Prerequisites

- Node.js >= 20
- pnpm 9.15.4
- Docker (for local Postgres)

---

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy and fill in env vars
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, etc.

# 3. Start local Postgres via Docker
pnpm infra:up

# 4. Run migrations
pnpm db:migrate

# 5. Seed the database
pnpm db:seed
```

---

## Running the App

All commands are run from the **repo root**.

| Command | What it does |
|---|---|
| `pnpm dev` | Starts API (port 3001) + Web (port 3000) in parallel, env loaded from `.env` |
| `pnpm infra:up` | Starts local Postgres via Docker Compose |
| `pnpm infra:down` | Stops Docker Compose services |
| `pnpm build` | Builds all apps |
| `pnpm lint` | Lints all apps |
| `pnpm typecheck` | Typechecks all apps |

**Important:** Always use `pnpm dev` from root — it loads `.env` automatically via `dotenv-cli`. Do NOT run `pnpm dev` from inside `apps/api` or `apps/web` directly, as env vars will not be loaded.

---

## Database Commands

All DB commands are run from the **repo root**.

| Command | What it does |
|---|---|
| `pnpm db:migrate` | Run pending Prisma migrations (dev mode, creates migration files) |
| `pnpm db:seed` | Run seed script |
| `pnpm db:reset` | Reset DB and re-run all migrations (destructive — local only) |
| `pnpm db:deploy` | Apply migrations without creating new files (for staging/prod) |
| `pnpm db:studio` | Open Prisma Studio (visual DB browser) |
| `pnpm db:generate` | Regenerate Prisma Client after schema changes |

---

## Ports

| Service | Port |
|---|---|
| API (NestJS) | 3001 |
| Web (Next.js) | 3000 |
| Postgres (Docker) | 5442 |

---

## Seed Accounts

After running `pnpm db:seed`:

| Email | Password | Role | Tenant |
|---|---|---|---|
| `admin@local.test` | (from `ADMIN_PASSWORD` in `.env`) | Platform Admin | admin |
| `owner@peak-hardware.test` | `Password123!` | OWNER | peak-hardware |
| `staff@peak-hardware.test` | `Password123!` | STAFF | peak-hardware |
| `owner@metro-pizza.test` | `Password123!` | OWNER | metro-pizza-supply |
| `staff@metro-pizza.test` | `Password123!` | STAFF | metro-pizza-supply |
| `owner@corner-general.test` | `Password123!` | OWNER | corner-general |
| `staff@corner-general.test` | `Password123!` | STAFF | corner-general |

Default password for all non-admin seed users: `Password123!` (overrideable via `SEED_DEFAULT_PASSWORD` in `.env`)

---

## Testing

### API Tests (Claude's responsibility)
- Claude writes and runs E2E tests (Jest + Supertest) after every API implementation
- Tests are run before asking the user to commit
- Do NOT use curl for API testing — use E2E tests only
- See `RULES.md` for the full testing policy

### UI Tests (User's responsibility)
- Manual browser testing at `http://localhost:3000`
- Claude provides exact steps and expected outcomes

### E2E Tests (Jest + Supertest)
- Located in `apps/api/test/`
- Run with: `pnpm --filter api test:e2e`
- Required for every new API endpoint before merging a PR
- Tests run against a **separate test database** (`b2b_saas_test`) — never the dev DB

**One-time test DB setup (run once after cloning):**
```bash
# Create the test database
PGPASSWORD=postgres psql -h localhost -p 5442 -U postgres -c "CREATE DATABASE b2b_saas_test;"

# Apply all migrations
DATABASE_URL="postgresql://postgres:postgres@localhost:5442/b2b_saas_test?schema=public" \
  npx prisma migrate deploy --schema=./packages/db/prisma/schema.prisma

# Seed test data
DATABASE_URL="postgresql://postgres:postgres@localhost:5442/b2b_saas_test?schema=public" \
  npx prisma db seed --schema=./packages/db/prisma/schema.prisma
```

After each new migration, re-run migrate deploy + seed against the test DB.

---

## Creating a New Migration

```bash
pnpm db:migrate
# Prisma will prompt for a migration name, or pass --name:
# pnpm db:migrate -- --name add_your_change_here
```

Naming convention: `snake_case`, descriptive, table-prefixed where applicable.
Examples: `add_cost_cents_to_sku`, `create_inventory_movement`, `add_features_to_tenant`

---

## Git & PR Workflow

This project uses the **GitHub CLI (`gh`)** for all PR and branch operations. Install it once:

```bash
brew install gh   # macOS
gh auth login     # authenticate once
```

### Typical feature cycle

```bash
# 1. Branch off main
git checkout -b feat/your-feature

# 2. Work, commit
git add <files>
git commit -m "feat: ..."

# 3. Push and open PR
git push -u origin feat/your-feature
gh pr create --title "feat: ..." --body "..."

# 4. Merge (squash) and delete remote branch
gh pr merge --squash --delete-branch

# 5. Sync local main and delete local branch
git checkout main && git pull
git branch -d feat/your-feature
```

### Branch naming

| Prefix | Use for |
|--------|---------|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `chore/` | Dependency updates, tooling, infra |
| `docs/` | Documentation only |

### Stale branch cleanup

Old local branches (already merged or abandoned) should be deleted:
```bash
git branch -d branch-name       # safe delete (errors if unmerged)
git branch -D branch-name       # force delete
git remote prune origin         # prune remote tracking refs
```
