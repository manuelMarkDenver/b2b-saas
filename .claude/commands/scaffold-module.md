---
description: Scaffold a new NestJS module following project conventions (controller, service, dto, module file)
argument-hint: <module-name> (e.g. orders, payments, inventory)
---

Scaffold a new NestJS module named `$ARGUMENTS` inside `apps/api/src/`.

Follow the exact conventions used in existing modules (e.g. `catalog`, `tenants`, `auth`). Do the following:

1. Read 1–2 existing modules first (e.g. `apps/api/src/catalog/`) to match the exact code style, decorator usage, and file structure.
2. Create these files under `apps/api/src/$ARGUMENTS/`:
   - `$ARGUMENTS.module.ts` — NestJS module with imports, controllers, providers
   - `$ARGUMENTS.controller.ts` — REST controller with proper route prefix and guards
   - `$ARGUMENTS.service.ts` — Service class with PrismaService injected, always filtering by `tenantId`
   - `dto/create-$ARGUMENTS.dto.ts` — DTO with class-validator decorators
3. Register the new module in `apps/api/src/app.module.ts`.
4. Ensure every service method filters by `tenantId` — never trust client-provided tenantId, always derive from authenticated context.
5. Follow the logging pattern used in existing services.
6. Do NOT add any feature that is not MVP-CRITICAL. No marketplace, no mobile, no barcode logic.
7. After scaffolding, confirm what was created and what still needs to be implemented.
