# Milestones

This project is delivered milestone-by-milestone. Do not pull work forward.

## Milestone 1 - Foundation

Definition of done:

- Repo scaffold: `apps/api`, `apps/web`, `packages/db`, `infra/`.
- Local Postgres via Docker Compose.
- Prisma wired and first migration runs.
- API boots, connects to DB, `GET /health` works.
- Web boots, calls API health endpoint.
- Structured application logging (request id + request logs).
- Env var strategy documented and `.env.example` present.
- Light/dark mode toggle in web + tenant theme token plumbing (stubbed).

## Milestone 2 - Users/Tenants/Auth Foundation

- Users, tenants, memberships.
- Auth baseline.
- Active tenant context.

Notes:

- Social login (Google, Facebook/Meta) is LATER; Phase 1 auth should not depend on it.

## Milestone 3 - Roles/Permissions

- Tenant roles/permissions.
- Guards.
- Platform admin separation.

## Milestone 4 - Categories/Products/SKU/Light Inventory

## Milestone 5 - Marketplace Browse/Search

## Milestone 6 - Order Request + Transaction Tracking

## Milestone 7 - Tenant Settings + Audit Logs + Logging Refinement

## Milestone 8 - Hardening + Seed + QA + Staging/Prod Prep
