# Deployment

> Last updated: 2026-04-03

This document covers the deployment strategy: current free-tier setup for early stage, and the path to scale as the platform grows.

---

## Current Stack (Free / Very Low Cost)

| Service | Platform | Tier | Cost |
|---|---|---|---|
| Web (Next.js) | Vercel | Hobby (free) | $0/mo |
| API (NestJS) | Render | Free (spins down when idle) | $0/mo |
| Database (Postgres) | Neon | Free (0.5 GB, branching) | $0/mo |
| File Storage (R2) | Cloudflare R2 | Free (10 GB, 1M reads/day) | $0/mo |
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

### 2. File Storage (Cloudflare R2)

The API supports both local disk and S3-compatible storage (including Cloudflare R2). For staging, use R2.

1. Create a Cloudflare account at [cloudflare.com](https://cloudflare.com) (free tier is sufficient).
2. In the Cloudflare dashboard, go to **R2** → **Create bucket**.
   - Name it something like `zentral-uploads` or `yourplatform-uploads`.
   - Leave the default settings.
3. Create an **R2 API Token** with **Object Read & Write** permission for the bucket:
   - R2 → **Manage R2 API Tokens** → **Create API token**.
   - Permissions: `Object Read` + `Object Write`.
   - Scope: select your bucket.
   - Note the **Access Key ID** and **Secret Access Key**.
4. Make the bucket **publicly readable** so uploaded images are accessible:
   - R2 → your bucket → **Settings** → **Public Access**.
   - Enable public access (or set up a custom domain via Cloudflare Workers).
   - Note the **Public bucket URL** (format: `https://pub-<account-id>.r2.dev`).
5. Note the **R2 endpoint** (format: `https://<account-id>.r2.cloudflarestorage.com`).

These values will be set as Render env vars in the next step.

**Upload path structure (S3/R2):** Files are stored at `{tenantId}/{resourceType}/{branchId?}/{timestamp}-{random}.{ext}`. Examples: `abc-123/tenant-logo/1712345678-x9k2.png`, `abc-123/sku-image/branch-456/1712345678-m3n7.jpg`. The `resourceType` is passed as a query param (`?resourceType=sku-image`) from the frontend. Old flat `uploads/...` paths remain accessible — no migration needed.

### 3. API (Render)

The repo includes `render.yaml` at the root for Blueprint-based deploys.

**Option A — Render Blueprint (recommended):**
1. Push the repo to GitHub.
2. On Render: New → Blueprint → connect the repo.
3. Render reads `render.yaml` and creates the service automatically.
4. Fill in the `sync: false` secrets in the Render dashboard:
    - `DATABASE_URL` — Neon production connection string
    - `JWT_SECRET` — random 64-char string
    - `CORS_ALLOWED_ORIGINS` — your Vercel URL (set after step 4 below)
    - `SMTP_PASS` — Resend API key
    - `SMTP_FROM` — sender address (e.g. `noreply@yourplatform.com`)
    - `APP_BASE_URL` — this service's Render URL (e.g. `https://zentral-api.onrender.com`)
    - `APP_FRONTEND_URL` — your Vercel URL (set after step 4 below)
    - `AWS_S3_ENDPOINT` — R2 endpoint (e.g. `https://<account-id>.r2.cloudflarestorage.com`)
    - `AWS_ACCESS_KEY_ID` — R2 API token Access Key ID
    - `AWS_SECRET_ACCESS_KEY` — R2 API token Secret Access Key
    - `AWS_S3_BUCKET` — R2 bucket name (e.g. `zentral-uploads`)
    - `AWS_S3_PUBLIC_URL` — R2 public URL (e.g. `https://pub-<account-id>.r2.dev`)

**Option B — Manual:**
1. Create a new **Web Service** on [render.com](https://render.com).
2. Connect your GitHub repo.
3. Settings:
   - **Root directory:** `apps/api`
   - **Build command:** `npm install && npm run build`
   - **Start command:** `node dist/main`
   - **Environment:** set all vars from `ENVIRONMENT.md` (NODE_ENV=production, DATABASE_URL, JWT_SECRET, etc.)
4. Deploy. Render will build and start the API.
5. Note the Render URL (e.g. `https://b2b-saas-api.onrender.com`).

### 4. Web (Vercel)

The repo includes `vercel.json` at the root pointing to `apps/web`.

1. Import the repo on [vercel.com](https://vercel.com).
2. Vercel reads `vercel.json` — no manual root directory setting needed.
3. Add environment variable in the Vercel dashboard:
    - `NEXT_PUBLIC_API_BASE_URL` = `https://zentral-api.onrender.com` (your Render URL)
4. Deploy. Vercel will build and serve the Next.js app.
5. Note the Vercel URL (e.g. `https://zentral.vercel.app`).

### 5. Marketing Site (Vercel)

1. Import the same repo on [vercel.com](https://vercel.com) as a **separate project**.
2. Settings:
    - **Root directory:** `apps/marketing`
    - **Build command:** `next build`
    - **Output directory:** `.next`
3. Add environment variables:
    - `NEXT_PUBLIC_API_BASE_URL` = your Render API URL (optional, if marketing site links to API)
4. Deploy. Note the marketing URL (e.g. `https://zentral-marketing.vercel.app`).

### 6. Wire CORS

Set `CORS_ALLOWED_ORIGINS` on the Render API service to include both Vercel URLs:
```
CORS_ALLOWED_ORIGINS=https://zentral.vercel.app,https://zentral-marketing.vercel.app
```

Also set `APP_FRONTEND_URL` on Render to your main web URL:
```
APP_FRONTEND_URL=https://zentral.vercel.app
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

## CI/CD Strategy

**Current approach: Platform-native auto-deploy (no GitHub Actions).**

Both Render and Vercel provide built-in CI/CD — they watch the GitHub repo and auto-deploy on `git push`:

| Platform | Trigger | What it does |
|---|---|---|
| **Render** | Push to tracked branch | Runs `buildCommand`, then `preDeployCommand` (migrations), then `startCommand` |
| **Vercel** | Push to tracked branch | Runs ignore check, then `buildCommand` from `vercel.json`, deploys preview or production |

**No GitHub Actions, GitLab CI, or custom pipelines exist.** This is intentional for staging — the platforms handle everything.

### Vercel Ignore Build Step (monorepo)

Each Vercel project has an "Ignored Build Step" command in **Settings → Git → Ignored Build Step** that prevents unnecessary deploys. Use the `$VERCEL_GIT_PREVIOUS_SHA` variable (not `HEAD^`) so it catches all commits since the last deployment, not just the tip:

| Project | Command |
|---------|---------|
| `vercel-web` | `git diff $VERCEL_GIT_PREVIOUS_SHA $VERCEL_GIT_COMMIT_SHA --quiet -- apps/web/ packages/` |
| `vercel-marketing` | `git diff $VERCEL_GIT_PREVIOUS_SHA $VERCEL_GIT_COMMIT_SHA --quiet -- apps/marketing/ packages/` |

**Important:** Set behavior to **Custom** (not "Only build if there are changes in a folder"). Vercel advances `$VERCEL_GIT_PREVIOUS_SHA` on every processed push — even cancelled ones — so using `HEAD^` will miss accumulated web changes when a non-web commit lands on top.

**When to add GitHub Actions (post-staging):**
- Run lint/typecheck/tests on every PR before merge
- Block merges when checks fail (branch protection)
- Multi-step deploy gates (e.g. staging → prod approval)
- Automated database backups before migrations

**Environment file strategy:**

| File | Purpose | Committed? |
|---|---|---|
| `.env` | Local development defaults | ❌ No |
| `.env.example` | Template for new devs | ✅ Yes |
| `.env.staging` | Staging env var reference | ❌ No — set in Render/Vercel dashboards |
| `.env.prod` | Production env var reference | ❌ No — set in Render/Vercel dashboards |

The `.env.staging` and `.env.prod` files serve as **checklists only** — actual secrets are injected via platform dashboards (Render env vars, Vercel env vars). They are gitignored by the `*.env.*` rule in `.gitignore` (with `!.env.example` exception).

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
- [ ] `STORAGE_TYPE=s3` and all `AWS_*` vars set for Cloudflare R2
- [ ] `LOG_PRETTY=false` (structured JSON logs in production)
- [ ] `ADMIN_PASSWORD` is a strong password — change after first login
- [ ] `.env` file is NOT deployed (env vars injected via platform)

---

## Local Email Testing (Mailpit)

For local development, Mailpit catches all outgoing emails without sending real ones.

```bash
# Start Mailpit alongside the DB
docker compose -f infra/docker-compose.yml up -d mailpit

# Open the web UI to view caught emails
open http://localhost:8025
```

The API `.env.example` is pre-configured to use Mailpit (`SMTP_HOST=localhost`, `SMTP_PORT=1025`).
No `SMTP_USER` / `SMTP_PASS` needed locally — Mailpit accepts anonymous connections.

---

## Database Backups

- **Neon Free**: no point-in-time recovery. Manual export only:
  ```bash
  pg_dump <neon-connection-string> > backup-$(date +%Y%m%d).sql
  ```
- **Neon Pro**: automatic point-in-time recovery up to 7 days.
- Run a manual backup before every migration on production.
