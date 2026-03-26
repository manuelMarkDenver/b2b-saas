# AGENTS.md

This file is given to agentic coding agents (like OpenCode) that operate in this repo.
It should reflect the repo's actual tooling and conventions.

Current state: Milestone 1 foundation is scaffolded.

---

## Quick Start (Once Tooling Exists)

- Install deps: `pnpm i`
- Start Postgres: `pnpm infra:up`
- Run migrations + seed: `pnpm db:migrate && pnpm db:seed`
- Start local dev (api+web): `pnpm dev`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Tests (api): `pnpm --filter api test`
- Single test (api): `pnpm --filter api test:one "Test name"`

Common single-test patterns (examples only):

- Vitest: `vitest path/to/test.test.ts -t "name"`
- Jest: `jest path/to/test.test.ts -t "name"`
- Playwright: `playwright test path/to/spec.spec.ts -g "name"`
- pytest: `pytest path/to/test_file.py -k "expr"`

---

## Code Style (Defaults Until Repo Defines)

- Keep diffs small; avoid drive-by refactors.
- Prefer the repo formatter/linter once present.
- Imports: standard -> third-party -> internal; remove unused.
- Naming: descriptive; avoid abbreviations; stable API naming.
- Types: explicit at boundaries; avoid `any` unless justified.
- Errors: fail fast; consistent error shape; don't leak secrets.
- Logging: structured; no secrets; include request id where available.

---

## Cursor/Copilot Rules

No Cursor rules found (no `.cursor/rules/` or `.cursorrules`).
No Copilot instructions found (no `.github/copilot-instructions.md`).
