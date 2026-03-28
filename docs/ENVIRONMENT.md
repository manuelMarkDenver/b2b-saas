# Environment

Principles:

- Local: `.env` files for developer convenience.
- Staging/prod: inject environment variables via the platform (no `.env` in images).
- Fail fast on missing/invalid env vars.

## Required (Milestone 1)

API

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `LOG_LEVEL`
- `LOG_PRETTY` (local only)
- `JWT_SECRET`
- `JWT_EXPIRES_IN_SECONDS` — recommended: `86400` (24h). No refresh tokens in MVP.

WEB

- `PORT`
- `NEXT_PUBLIC_API_BASE_URL`

Seed

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_TENANT_NAME`
- `ADMIN_TENANT_SLUG`

## Required (Milestone 8)

API — Rate limiting

- `THROTTLE_TTL` — time window in ms (default: `60000` = 1 minute)
- `THROTTLE_LIMIT` — max requests per window on auth endpoints (default: `10`)

API — Email (password reset)

- `SMTP_HOST` — e.g. `smtp.resend.com` or `smtp.gmail.com`
- `SMTP_PORT` — e.g. `587`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM` — sender address, e.g. `noreply@yourplatform.com`
- `APP_BASE_URL` — used to build reset links, e.g. `https://yourplatform.com`

API — CORS

- `CORS_ALLOWED_ORIGINS` — comma-separated list of allowed origins, e.g. `https://yourplatform.vercel.app,https://yourplatform.com`

## Post-MVP

API — Notifications (Messenger / WhatsApp / SMS)

- `META_APP_ID`
- `META_APP_SECRET`
- `META_ACCESS_TOKEN` — page-level access token for Meta Cloud API
- `REPLICATE_API_TOKEN` — for AI image generation via `/generate-image` skill (dev only)

## Naming

- Public client vars must be prefixed with `NEXT_PUBLIC_`.
- Secrets (JWT_SECRET, SMTP_PASS, META_ACCESS_TOKEN) must NEVER be committed or logged.
