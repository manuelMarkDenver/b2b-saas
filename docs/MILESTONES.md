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

Definition of done:

- Users, tenants, memberships.
- Auth baseline (email/password).
- Active tenant context (path + header + membership checks).
- Basic tenant switching UX (select active tenant).

Notes:

- Social login (Google, Facebook/Meta) is LATER; Phase 1 auth should not depend on it.
- Local seed creates a platform admin + default tenant for dev convenience.

## Milestone 3 - Roles/Permissions

Definition of done:

- Tenant roles/permissions (roles as permission bundles).
- Permission guards on tenant routes.
- Platform admin separation.

## Milestone 4 - Categories/Products/SKU/Light Inventory

Definition of done:

- Platform-managed categories.
- Product + SKU CRUD (SKU unique per tenant).
- Light inventory fields only.

## Milestone 5 - Marketplace Browse/Search

Definition of done:

- Shared marketplace browse/search across tenants.
- Guest + logged-in buyer entry points.
- Basic filters (category/tenant).

## Milestone 6 - Order Request + Transaction Tracking

Definition of done:

- Single-tenant order/request flow.
- Basic transaction tracking.

## Milestone 7 - Tenant Settings + Audit Logs + Logging Refinement

Definition of done:

- Tenant settings/branding stored (tokens, logo).
- Audit log tables + write points.
- Application logging refinement.

## Milestone 8 - Hardening + Seed + QA + Staging/Prod Prep

Definition of done:

- Seed data expanded for QA.
- QA checklist.
- Staging/prod readiness notes and env checklist.
