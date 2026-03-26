# Architecture

## High-Level

- Modular monolith in one repo.
- Processes:
  - `web` (Next.js): UI, public marketplace browsing.
  - `api` (NestJS): REST API, auth, business rules.
- Database: Postgres.

## Module Boundaries (API)

- `common/`: cross-cutting concerns (config, logging, prisma, http errors).
- Feature modules added per milestone (auth, tenants, products, etc.).

## Tenancy

- Platform-owned data: no `tenantId`.
- Tenant-owned data: required `tenantId`.
- Requests carry tenant context (later via auth + route context).

## Web Tenancy Routing

- Tenant context in path: `/t/:tenantSlug/...`.
- Shared marketplace still spans tenants; tenant slug used for seller views and tenant-branded flows.
