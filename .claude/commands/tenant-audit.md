---
description: Audit all service files for missing tenantId filters — catches multi-tenant safety violations
---

Perform a multi-tenant isolation audit across the entire API codebase.

Do the following:

1. Search all files in `apps/api/src/**/*.service.ts` for Prisma query calls (`findMany`, `findFirst`, `findUnique`, `update`, `delete`, `create`).
2. For each query on a tenant-scoped table (Products, SKUs, Orders, OrderItems, Payments, InventoryMovements, TenantMemberships), verify that `tenantId` is present in the `where` clause.
3. Flag any query that:
   - Is missing `tenantId` in the `where` clause
   - Accepts `tenantId` directly from a request body/params (client-provided — must be derived from auth context instead)
   - Uses `findUnique` by ID alone without scoping to tenantId
4. Output a report:
   - ✅ Safe queries (tenantId correctly enforced)
   - ⚠️ Suspicious queries (needs review)
   - ❌ Violations (missing tenantId — must fix before merge)
5. Do NOT auto-fix. Report only. Ask the user which violations to fix.
