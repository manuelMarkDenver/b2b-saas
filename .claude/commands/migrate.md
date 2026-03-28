---
description: Run a Prisma migration with enforced naming convention
argument-hint: <description> (e.g. add_inventory_movement, add_cost_cents_to_sku)
---

Run a Prisma migration for the change described as: `$ARGUMENTS`

Follow these steps:

1. Enforce naming convention: snake_case, descriptive, prefixed with the affected table if applicable (e.g. `add_cost_cents_to_sku`, `create_inventory_movement`, `add_features_to_tenant`).
2. Run: `cd packages/db && npx prisma migrate dev --name $ARGUMENTS`
3. After migration succeeds, confirm:
   - Migration file was created under `packages/db/prisma/migrations/`
   - Schema change is reflected correctly
   - No existing data integrity issues introduced
4. Remind to update `docs/DATA_MODEL.md` if the migration adds or changes a model.
5. If the migration fails, diagnose and explain the error — do NOT retry blindly.
