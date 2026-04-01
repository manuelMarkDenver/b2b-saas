# White-Label Architecture

This document covers how Ascendex supports multiple branding tiers — from a
standard SaaS subscription all the way to fully rebranded deployments for
franchise networks and resellers.

---

## Branding Tiers

| Tier | Name | Who | Platform branding | Domain | Billing model |
|------|------|-----|-------------------|--------|---------------|
| **1** | Standard | SME subscribers | Full Ascendex | `app.ascendex.ph` | Monthly subscription (PayMongo) |
| **2** | Custom Domain | Premium Ascendex subscribers | Ascendex + custom URL | `app.theirbusiness.com` | Monthly subscription (PayMongo) |
| **3** | White Label | MGN (MSME Growth Network) | MGN branding; Ascendex invisible | `app.mgn.ph` | One-time joining fee + % per transaction |
| **4** | Reseller | Third-party partners | Partner branding | Partner domain | Negotiated; sublicensing |

---

## How Branding Works

Platform branding (name, logo, tagline, support email) is controlled entirely
by **build-time environment variables** prefixed with `NEXT_PUBLIC_PLATFORM_`.
No code change is needed to rebrand — just a different `.env` on a separate
deployment.

### Config file

**`apps/web/src/lib/platform-config.ts`** — single source of truth.

```typescript
export const platformConfig: PlatformConfig = {
  name:         process.env.NEXT_PUBLIC_PLATFORM_NAME         ?? 'Ascendex',
  tagline:      process.env.NEXT_PUBLIC_PLATFORM_TAGLINE      ?? 'Business Operations Platform',
  logoIconUrl:  process.env.NEXT_PUBLIC_PLATFORM_LOGO_ICON_URL ?? '/logo-icon.svg',
  supportEmail: process.env.NEXT_PUBLIC_PLATFORM_SUPPORT_EMAIL ?? 'support@ascendex.ph',
  marketingUrl: process.env.NEXT_PUBLIC_PLATFORM_MARKETING_URL ?? 'https://ascendex.ph',
};
```

### Environment variables per tier

#### Tier 1 & 2 — Ascendex (defaults, no override needed)
```env
NEXT_PUBLIC_PLATFORM_NAME=Ascendex
NEXT_PUBLIC_PLATFORM_TAGLINE=Business Operations Platform
NEXT_PUBLIC_PLATFORM_LOGO_ICON_URL=/logo-icon.svg
NEXT_PUBLIC_PLATFORM_SUPPORT_EMAIL=support@ascendex.ph
NEXT_PUBLIC_PLATFORM_MARKETING_URL=https://ascendex.ph
```

#### Tier 3 — MGN (separate Vercel/Render deployment)
```env
NEXT_PUBLIC_PLATFORM_NAME=MGN Business Suite
NEXT_PUBLIC_PLATFORM_TAGLINE=Empowering MSMEs Nationwide
NEXT_PUBLIC_PLATFORM_LOGO_ICON_URL=https://media.mgn.ph/logo-icon.svg
NEXT_PUBLIC_PLATFORM_SUPPORT_EMAIL=support@mgn.ph
NEXT_PUBLIC_PLATFORM_MARKETING_URL=https://mgn.ph
```

#### Tier 4 — Reseller (per-partner deployment)
Same pattern; each reseller gets their own Vercel project + Render service with
their env vars.

---

## Three-Surface Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  apps/web          — ERP dashboard (shared across all tiers)     │
│  apps/marketing    — Ascendex marketing site (Tier 1/2)          │
│  apps/marketing-mgn — MGN marketing site (Tier 3)               │
└──────────────────────────────────────────────────────────────────┘
```

The ERP (`apps/web`) is the same codebase for all tiers.
Brand identity is swapped via env vars at deploy time.

---

## Three Isolation Layers

```
Feature flags → organizationId → tenantId
```

| Layer | Purpose |
|-------|---------|
| `features` JSON on Tenant | Gates which modules are enabled (orders, inventory, reports, etc.) |
| `organizationId` (future) | Groups tenants under a white-label org (e.g. all MGN franchisees) |
| `tenantId` | Hard data boundary — all queries must include tenantId |

The `features.network` flag gates MGN-specific features: agent layer,
franchise commission tracking, network marketplace.

---

## MGN — Franchise / Agent Model

MGN operates as a **Tier 3 white-label** client with additional franchise
network features gated behind `features.network`.

### Revenue model
- One-time joining fee per MSME franchisee (paid to MGN)
- MGN takes a % per transaction processed through the platform
- Ascendex charges MGN a platform fee (separate B2B agreement)

### Agent-based commission (two design options — decision pending)

**Option A — Tenant-as-agent**
Every MGN franchisee Tenant is itself an agent node. Commission flows directly
on the Tenant hierarchy. Simpler; less flexible.

**Option B — Dedicated Agent entity**
A separate `Agent` model that can be linked to multiple tenants and to a
`NetworkNode` / `Commission` table. More flexible for complex MLM structures.

Both options share a common core:
- `NetworkNode` — hierarchy (parent/child agent relationships)
- `Commission` — triggered on `Payment → VERIFIED`
- Payout calculated as a percentage of the verified payment amount

Decision deferred until MGN onboarding begins.

---

## Deployment Guide

See `docs/DEPLOYMENT.md` for the step-by-step deployment process for each tier.

### Quick reference

| Tier | Web deployment | API deployment | DB |
|------|---------------|---------------|----|
| 1/2 (Ascendex) | Vercel — `ascendex` project | Render — `ascendex-api` | Neon |
| 3 (MGN) | Vercel — `mgn-web` project | Render — `mgn-api` (or same API, different env) | Neon (separate schema or DB) |
| 4 (Reseller) | Vercel — per partner | Render — per partner | Neon — per partner |

---

## Sidebar Layout

```
┌─────────────────────────┐
│  [icon] Ascendex        │  ← platform header (NEXT_PUBLIC_PLATFORM_* vars)
├─────────────────────────┤
│  WORKSPACE              │
│  [logo] Metro Pizza...  │  ← tenant workspace (unchanged, per-tenant)
│  Branch switcher        │
├─────────────────────────┤
│  nav items              │
└─────────────────────────┘
```

For a Tier 3 (MGN) deployment, the platform header reads "MGN Business Suite"
with the MGN logo. The workspace section below it still shows each franchisee's
business name and logo — unchanged.

---

## Future: Runtime White-Label (Tier 4 advanced)

Currently branding is **build-time** (env vars baked in at Vercel build).
For advanced Tier 4 resellers who need runtime branding changes without
redeploy, the roadmap path is:

1. Add `Organization` model with `platformName`, `platformLogoUrl`, `primaryColor`
2. Tenant belongs to Organization
3. `GET /tenant/context` returns org branding
4. `TenantShell` reads org branding from API response (overrides env defaults)
5. CSS variables updated at runtime

This is **not needed for MVP** — env-var approach covers Tiers 1-3 fully.
