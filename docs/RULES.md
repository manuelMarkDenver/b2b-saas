# Rules

This is the living rulebook for building the Phase 1 MVP.

## Scope Guardrails

MUST (Phase 1)

- Modular monolith: Next.js (web) + NestJS (api) + Postgres.
- Multi-tenant foundation: tenants, memberships, tenant-scoped RBAC.
- Shared marketplace browsing across tenants.
- Products only, with SKU support (unique per tenant).
- Guest + logged-in buyer flows.
- Single-tenant order-request / interest flow.
- Light inventory only.
- Tenant settings/branding foundation.
- Audit logs (DB) + application logs (structured).
- Future-ready notification event points only.

NOT in Phase 1

- Billing/payments.
- Self-serve tenant signup.
- Multi-vendor cart.
- Full inventory ledger.
- Microservices/Kubernetes/CQRS/event sourcing.

## Multi-Tenant Rules

- Every row is explicitly owned by either the platform or a tenant.
- Tenant ownership is represented by `tenantId` (UUID) on tenant-owned tables.
- Platform-owned tables have no `tenantId` (e.g., platform categories).
- Never infer tenant from user without explicit membership checks.

## Frontend Theming Rules

- Support light/dark mode via `next-themes`.
- Tenant branding uses CSS variables (few tokens only in Phase 1).
- Tenant selection is path-based: `/t/:tenantSlug/...`.
- No custom domains in Phase 1.

## Git Workflow Rules

MUST

- Do all work on a new branch (fix/feat/chore/docs) and merge to `main` via PR.
- Keep `main` green (lint/typecheck/tests passing) before merge.
- Multiple PRs per milestone are allowed if each PR is labeled with the milestone
  and its purpose is clearly described in the title/body.

SHOULD

- Use branch prefixes: `milestone-<n>/...`, `feat/...`, `fix/...`, `chore/...`.
- Squash merge PRs to keep history readable.

## White-Label Rule

MUST

- Avoid hard-coding tenant-specific business names, copy, or assets in shared components.
- Tenant branding is token-driven (CSS variables + settings), and must be overrideable per tenant.
- URLs, email templates, and UI strings should be designed to be tenant-aware later.

## API Conventions (Baseline)

- REST only.
- Consistent JSON error shape.
- UUIDs for identifiers.
- No PII/secrets in logs.

## Authentication Roadmap

LATER (not Phase 1 unless explicitly pulled in)

- OAuth/OIDC social login (Google, Facebook/Meta) for account creation and login.
- Keep auth design compatible with multiple identity providers.
- Do not block Phase 1 on social login; implement email/password or magic link first (Milestone 2).
- Do not implement features that are not listed in `docs/MILESTONES.md`.
- If a feature becomes necessary, update the milestone doc first, then implement.
