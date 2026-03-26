# Data Model Notes

## Ownership

- Every table is either platform-owned or tenant-owned.
- Tenant-owned tables include `tenantId` and are always filtered by it.

## Identifiers

- UUID primary keys.
- `tenantSlug` is a unique, human-readable identifier used in URLs.

## Phase 1 Reminder

- Products only.
- SKU unique per tenant.
- Light inventory fields only.
