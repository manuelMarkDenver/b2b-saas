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

WEB

- `PORT`
- `NEXT_PUBLIC_API_BASE_URL`

## Naming

- Public client vars must be prefixed with `NEXT_PUBLIC_`.
