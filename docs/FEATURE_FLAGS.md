# Feature Flags

How the feature flag system works end-to-end — what files are involved, how they connect, and how to add a new flag correctly.

---

## The Two Concepts

| Concept | What it means |
|---------|--------------|
| **Shipped** | The feature is built and working in the platform code. If `false`, the feature cannot be enabled by anyone — it simply doesn't exist yet from the product's perspective. |
| **Enabled** | A specific tenant has turned the feature on. Only meaningful when `shipped: true`. |

A feature must be both **shipped** AND **enabled for the tenant** to be active.

---

## The 4 Layers (all required for a flag to be fully functional)

### Layer 1 — Product Registry
**File:** `packages/shared/src/features.ts`

This is the master list. Every feature must exist here.

```ts
{
  key: 'myFeature',          // unique identifier used everywhere
  label: 'My Feature',
  description: 'What it does',
  icon: 'IconName',
  shipped: true,             // true = built; false = Coming Soon
  badge: 'Beta',             // optional — shown on marketing/features page
  phase: 'MS22',             // optional — which milestone ships this
}
```

`shipped: false` → `isFeatureActive()` always returns `false`, guard always blocks.
`shipped: true`  → actual tenant setting is checked.

Two derived exports from this file:
- `SHIPPED_FEATURES` — filtered list used for the marketing page
- `FeatureFlag` — TypeScript union type of all shipped feature keys
- `isFeatureActive(key, tenant.features)` — the canonical check function

---

### Layer 2 — Tenant Database Value
**Location:** `Tenant.features` JSON column in Postgres

Stored as `{ inventory: true, orders: true, stockTransfers: false, ... }`. Set per tenant via the admin panel.

Default value is set at tenant creation — see `defaultFeatures` in `packages/db/prisma/seed.ts` and wherever tenants are created in the API.

---

### Layer 3 — Admin Toggle UI
**File:** `apps/web/src/app/admin/page.tsx` — `FLAG_KEYS` array

```ts
const FLAG_KEYS: (keyof TenantFeatures)[] = [
  "inventory", "orders", "payments", "reports", "marketplace",
  "stockTransfers", "paymentTerms",   // ← add new flags here
];
```

Also add the key to the `TenantFeatures` type in the same file. If missing here, the admin cannot toggle the flag per tenant via the UI (though the DB column still stores it).

---

### Layer 4 — Guard at the Usage Point
**This is the most commonly missed layer.**

#### Frontend (sidebar nav)
`apps/web/src/components/layout/sidebar.tsx`

Add `featureKey` to the nav item:
```ts
{ label: 'My Feature', href: '/my-feature', icon: MyIcon, featureKey: 'myFeature' }
```
`isFeatureActive(featureKey, features)` is called automatically — hides the nav item if inactive.

#### API (NestJS controller)
Two options:

**Option A — Decorator (for shipped features only)**
```ts
import { FeatureFlagGuard, RequireFeature } from '../common/auth/feature-flag.guard';

@UseGuards(JwtAuthGuard, TenantGuard, FeatureFlagGuard)
@RequireFeature('myFeature')   // only works if shipped: true
@Controller('my-feature')
```
`FeatureFlagGuard` checks `tenant.features[flag] === true`. Returns 403 if not.

**Option B — Inline check (for unshipped or conditional flags)**
```ts
@Post()
create(@Req() req: RequestWithUser, @Body() dto: CreateDto) {
  const features = req.tenant!.features as Record<string, boolean> | null;
  if (!features?.myFeature) {
    throw new ForbiddenException("Feature 'myFeature' is not enabled for this tenant");
  }
  // ...
}
```
Use this when the flag key is not in the `FeatureFlag` type (i.e. `shipped: false`) or when the guard should only apply to specific conditions (e.g. only if a certain field is present in the body).

---

## Current Flag Status

| Key | Shipped | Default | API Guard | Nav Guard | Notes |
|-----|---------|---------|-----------|-----------|-------|
| `inventory` | ✅ | true | ✅ decorator | ✅ featureKey | Core feature |
| `orders` | ✅ | true | ✅ decorator | ✅ featureKey | Core feature |
| `payments` | ✅ | true | ✅ decorator | ✅ featureKey | Core feature |
| `reports` | ✅ | true | ✅ decorator | ✅ featureKey | Core feature |
| `marketplace` | ✅ | false | — | — | Phase 7, not built |
| `stockTransfers` | ❌ Coming Soon | false | ✅ inline | ✅ shipped gate | MS21 — built but hidden from marketing |
| `paymentTerms` | ❌ Coming Soon | false | ✅ inline | — (no nav item) | MS21 — DTO field guarded |
| `multipleBranches` | ✅ | false | ✅ inline (branches.service) | ✅ (Add Branch hidden) | Subscription gate — see Plan Limits below |
| `advancedAnalytics` | ❌ Not built | false | — | — | Post-Phase 5 — Key Metrics + Product/Customer Ranking |

> **`stockTransfers` note:** The API and UI are built (`shipped` was temporarily set to `false` to hide from nav during pre-staging). The inline guard enforces it at the API level regardless.

> **`multipleBranches` note:** The flag gates access to adding more branches. The numeric cap is `Tenant.maxBranches` (default `1`). Both must pass: flag on AND `branchCount < maxBranches`. Admin sets `maxBranches` per tenant via `/admin`. Demo seed tenants get `maxBranches: 3` with the flag on. New tenants default to flag off, `maxBranches: 1`.

> **`advancedAnalytics` scope:** (1) Shopee-style Key Metrics dashboard — clickable stat cards toggle multi-line trend chart, up to 4 metrics selected, delta vs previous period shown. (2) Product ranking by revenue/units/frequency. (3) Customer ranking by spend. Full design notes in `MILESTONES.md`.

---

## Plan Limits

Plan limits are **numeric** controls on the Tenant record — distinct from feature flags (boolean on/off). They gate *quantity*, not *capability*.

| Field | Type | Default | Who sets it | Notes |
|-------|------|---------|-------------|-------|
| `maxBranches` | `Int` | `1` | Super Admin via `/admin` | Only meaningful when `multipleBranches` flag is `true` |

**How branch creation is guarded** (`branches.service.ts:create()`):
1. Check `tenant.features.multipleBranches === true` → 403 if not
2. Check `branchCount < tenant.maxBranches` → 403 if at limit

**Admin control:** `PATCH /admin/tenants/:id/limits` `{ maxBranches: N }` — authenticated platform admin only.

**Future plan fields** (not yet implemented): `maxUsers`, `maxSkus`, `storageGb` — added here when subscription tiers are defined.

---

## How to Add a New Flag (checklist)

- [ ] Add entry to `PLATFORM_FEATURES` in `packages/shared/src/features.ts`
  - Set `shipped: false` while building, flip to `true` when ready to ship
- [ ] Add key to `TenantFeatures` type in `apps/web/src/app/admin/page.tsx`
- [ ] Add key to `FLAG_KEYS` array in same file
- [ ] Add `defaultFeatures` entry in `packages/db/prisma/seed.ts`
- [ ] Add guard at API usage point (`@RequireFeature` if shipped, inline if not)
- [ ] Add `featureKey` to sidebar nav item if feature has a dedicated page

---

## The `isFeatureActive` Function

```ts
// packages/shared/src/features.ts
export function isFeatureActive(
  key: string,
  tenantFeatures: Record<string, boolean> | null | undefined,
): boolean {
  const feature = PLATFORM_FEATURES.find((f) => f.key === key);
  if (!feature || !feature.shipped) return false;   // ← shipped gate
  return tenantFeatures?.[key] === true;             // ← tenant gate
}
```

Used by: sidebar nav, marketing features page, any frontend component checking flag status.
**Not used by:** the API `FeatureFlagGuard` (it skips the shipped check — intentional for flexibility).
