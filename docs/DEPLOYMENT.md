# Deployment

> Last updated: 2026-03-28

This document covers the deployment strategy: current free-tier setup for early stage, and the path to scale as the platform grows.

---

## Current Stack (Free / Very Low Cost)

| Service | Platform | Tier | Cost |
|---|---|---|---|
| Web (Next.js) | Vercel | Hobby (free) | $0/mo |
| API (NestJS) | Render | Free (spins down when idle) | $0/mo |
| Database (Postgres) | Neon | Free (0.5 GB, branching) | $0/mo |
| **Total** | | | **~$0/mo** |

**Constraints on free tier:**
- Render free tier spins down after 15min inactivity — first request takes ~30s cold start. Acceptable for early stage.
- Neon free tier is 0.5 GB storage, 1 compute unit. Sufficient for early tenants.
- Vercel Hobby has 100 GB bandwidth/mo — plenty for early stage.

---

## How to Deploy

### 1. Database (Neon)

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string (`postgresql://...`).
3. Run migrations against the production DB:
   ```bash
   DATABASE_URL="<neon-connection-string>" pnpm db:deploy
   ```
4. Run seed for initial platform admin:
   ```bash
   DATABASE_URL="<neon-connection-string>" pnpm db:seed
   ```

### 2. API (Render)

1. Create a new **Web Service** on [render.com](https://render.com).
2. Connect your GitHub repo.
3. Settings:
   - **Root directory:** `apps/api`
   - **Build command:** `npm install && npm run build`
   - **Start command:** `node dist/main`
   - **Environment:** set all vars from `ENVIRONMENT.md` (NODE_ENV=production, DATABASE_URL, JWT_SECRET, etc.)
4. Deploy. Render will build and start the API.
5. Note the Render URL (e.g. `https://b2b-saas-api.onrender.com`).

### 3. Web (Vercel)

1. Import the repo on [vercel.com](https://vercel.com).
2. Settings:
   - **Root directory:** `apps/web`
   - **Framework preset:** Next.js
   - **Environment variable:** `NEXT_PUBLIC_API_BASE_URL=https://b2b-saas-api.onrender.com`
3. Deploy. Vercel will build and serve the Next.js app.
4. Note the Vercel URL (e.g. `https://b2b-saas.vercel.app`).

### 4. Wire CORS

Set `CORS_ALLOWED_ORIGINS` on the Render API service to your Vercel URL:
```
CORS_ALLOWED_ORIGINS=https://b2b-saas.vercel.app
```

---

## Scaling Path (as client base grows)

You don't need to change anything until you have real load or paying customers. Scale incrementally:

### Stage 1 → Render Starter ($7/mo)
- Eliminates cold start (always-on instance)
- When: first paying customer, or cold starts become a problem

### Stage 2 → Neon Pro ($19/mo)
- 10 GB storage, autoscaling compute, point-in-time recovery
- When: data exceeds 0.5 GB or you need backups

### Stage 3 → Render Standard + horizontal scale ($25+/mo)
- Multiple API instances behind a load balancer
- When: API response times degrade under real traffic

### Stage 4 → AWS (Phase 8 of the platform roadmap)
- ECS (containers) + RDS (managed Postgres) + S3 (file storage) + CloudFront (CDN)
- **Subdomain routing per tenant**: `acme.yourplatform.com` routes to the correct tenant context
  - Vercel supports wildcard subdomains on Pro plan
  - Alternatively: Cloudflare Workers for edge routing
- When: multiple enterprise clients, compliance requirements, or needing full infrastructure control

---

## Subdomain Routing (Future — Phase 8)

When tenants outgrow shared URLs (`/t/:tenantSlug`) and need branded subdomains:

**Architecture:**
- DNS: wildcard `*.yourplatform.com` → Cloudflare or Vercel edge
- Edge layer reads the subdomain (`acme.yourplatform.com`) and maps it to a `tenantSlug`
- Next.js middleware resolves the tenant from the host header instead of the URL path
- No breaking change to the API — it still uses `x-tenant-slug` header or path param

**Why deferred:** Path-based routing (`/t/:tenantSlug`) is simpler and free. Subdomain routing requires a domain, wildcard DNS, and edge middleware. Not needed until tenants want white-labeled URLs.

---

## Environment Checklist for Production

Before going live, verify all of these:

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` points to Neon production DB (not local Docker)
- [ ] `JWT_SECRET` is a random 64-char string (not the dev default)
- [ ] `JWT_EXPIRES_IN_SECONDS=86400`
- [ ] `CORS_ALLOWED_ORIGINS` matches the Vercel production URL exactly
- [ ] `NEXT_PUBLIC_API_BASE_URL` matches the Render API URL exactly
- [ ] `THROTTLE_TTL` and `THROTTLE_LIMIT` set (MS8)
- [ ] SMTP vars set for password reset emails (MS8)
- [ ] `LOG_PRETTY=false` (structured JSON logs in production)
- [ ] `ADMIN_PASSWORD` is a strong password — change after first login
- [ ] `.env` file is NOT deployed (env vars injected via platform)

---

## Database Backups

- **Neon Free**: no point-in-time recovery. Manual export only:
  ```bash
  pg_dump <neon-connection-string> > backup-$(date +%Y%m%d).sql
  ```
- **Neon Pro**: automatic point-in-time recovery up to 7 days.
- Run a manual backup before every migration on production.
