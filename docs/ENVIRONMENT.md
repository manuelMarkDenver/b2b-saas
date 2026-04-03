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

API — Email (password reset + staff invitations)

- `SMTP_HOST` — **Production: `smtp.resend.com`**. Local dev: `localhost` (Mailpit)
- `SMTP_PORT` — **Production: `587`**. Local dev: `1025` (Mailpit)
- `SMTP_USER` — **Production: `resend`** (literal string, as required by Resend). Local dev: leave empty
- `SMTP_PASS` — **Production: your Resend API key**. Local dev: leave empty
- `SMTP_FROM` — sender address, e.g. `noreply@yourplatform.com`
- `APP_BASE_URL` — used to build reset links, e.g. `https://yourplatform.com`. **Local dev: `http://localhost:3000`**

**Local email testing — Mailpit:**
Mailpit is a local SMTP server + web UI for catching and inspecting outgoing emails during development. No real emails are sent.
- Run via Docker: add `mailpit` service to `docker-compose.yml` (image: `axllent/mailpit`).
- SMTP: `localhost:1025`
- Web UI (view emails): `http://localhost:8025`
- Covers: password reset emails, staff invitation emails, and any future transactional email in local dev.

API — CORS

- `CORS_ALLOWED_ORIGINS` — comma-separated list of allowed origins, e.g. `https://yourplatform.vercel.app,https://yourplatform.com`

API — File Storage (Cloudflare R2 / S3-compatible)

- `STORAGE_TYPE` — `local` (disk) or `s3` (S3/R2). **Production: `s3`**. Local dev: `local`
- `AWS_REGION` — **R2: `auto`**. AWS S3: your bucket region (e.g. `us-east-1`)
- `AWS_ACCESS_KEY_ID` — R2 API token Access Key ID (or AWS IAM access key)
- `AWS_SECRET_ACCESS_KEY` — R2 API token Secret Access Key (or AWS IAM secret key)
- `AWS_S3_BUCKET` — bucket name, e.g. `zentral-uploads`
- `AWS_S3_PUBLIC_URL` — public URL for the bucket. **R2: `https://pub-<account-id>.r2.dev`**. AWS S3: `https://<bucket>.s3.amazonaws.com`
- `AWS_S3_ENDPOINT` — **R2: `https://<account-id>.r2.cloudflarestorage.com`**. AWS S3: omit (uses AWS default)

## Post-MVP

API — Notifications (Messenger / WhatsApp / SMS)

- `META_APP_ID`
- `META_APP_SECRET`
- `META_ACCESS_TOKEN` — page-level access token for Meta Cloud API
- `REPLICATE_API_TOKEN` — for AI image generation via `/generate-image` skill (dev only)

API — AI Chatbot (post-MVP)

- `ANTHROPIC_API_KEY` — Claude API key for in-app chatbot and RAG features

## Naming

- Public client vars must be prefixed with `NEXT_PUBLIC_`.
- Secrets (JWT_SECRET, SMTP_PASS, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) must NEVER be committed or logged.
