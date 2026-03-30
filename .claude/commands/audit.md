# /audit — Pre-PR Codebase Audit

Perform a structured audit of the codebase. Check every area below, then produce a report using the 🔴/🟡/🟢 format. This must be run before every PR merge.

## 1. Tenant Isolation

Search `apps/api/src` for `findUnique` and `findFirst` calls that query by `id` alone without `tenantId` in the where clause. These are potential tenant data leaks.

Pattern to flag: `findUnique({ where: { id }` without a corresponding tenantId check before or after.
Pattern that is safe: `findFirst({ where: { id, tenantId } })`.

## 2. Guard Coverage

Check all `@Controller` classes in `apps/api/src`. Verify:
- Every tenant-scoped endpoint has both `JwtAuthGuard` AND `TenantGuard`
- Every platform-admin endpoint has `AdminGuard`
- No endpoint that touches tenant data is unguarded

List any endpoints missing expected guards.

## 3. Hardcoded Values

Search `apps/api/src` and `apps/web/src` for:
- Hardcoded currency symbols (₱, $, PHP) outside of `formatCents()` or designated formatter functions
- Hardcoded `localhost` URLs in TypeScript source files (not `.env` or config)
- Magic port numbers (3000, 3001) in source files
- Hardcoded tenant slugs or user IDs

## 4. Schema Integrity

Read `packages/db/prisma/schema.prisma` and check for:
- FKs that reference `tenantId` but are nullable when they shouldn't be
- Missing `@@index` on fields frequently used in WHERE clauses: `tenantId`, `status`, `createdAt`, `userId`
- Cascade delete settings — financial records (`Order`, `Payment`, `InventoryMovement`) must NOT cascade delete
- Any model missing `createdAt` or `updatedAt`

## 5. E2E Test Coverage

List all `@Controller` files in `apps/api/src`. Compare against `apps/api/test/*.e2e-spec.ts` files. Flag any controller with no corresponding E2E test file.

## 6. Security Patterns

Search for:
- `passwordHash` or `password` fields included in Prisma `select` responses that get returned to the client
- `console.log` statements in production code (`apps/api/src`, `apps/web/src`) — should use the pino logger
- Any `req.user` access without first verifying the guard sets it (unsafe in unguarded routes)
- Direct `stockOnHand` mutations via `sku.update({ data: { stockOnHand } })` — stock must only change via `InventoryMovement`

## 7. Data Integrity Rules

Verify these rules are enforced in code:
- `Order`, `Payment`, `InventoryMovement` — no DELETE endpoints exist
- `Product`, `Sku` — archive via `isArchived`, not deletion
- `TenantMembership` — deactivated via `status: DISABLED`, not deleted
- `User`, `Tenant` — no hard-delete endpoints

## Output Format

Produce findings grouped by severity:

### 🔴 Blocking — must fix before this PR merges
(List each finding with: file:line, description, suggested fix)

### 🟡 Warning — fix before staging deployment
(List each finding with: file:line, description, suggested fix)

### 🟢 Advisory — good to know, fix when convenient
(List each finding with: file:line, description)

### Summary Table

| Severity | Count |
|----------|-------|
| 🔴 Blocking | N |
| 🟡 Warning | N |
| 🟢 Advisory | N |
| ✅ All clear | — |

If zero 🔴 findings: state "✅ Clear to merge."
If any 🔴 findings: state "🚫 Do not merge — N blocking issue(s) found."
