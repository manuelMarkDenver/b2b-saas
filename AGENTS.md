# AGENTS.md

This repository directory is currently empty (no source code or config files detected).
As a result, there are no repo-specific build/lint/test commands or code-style rules to
extract.

Use this file as a starter. Once you add the real project files (or if you point the
agent at the actual repo root), update the sections below to match the tooling and
conventions that exist in-code.

---

## Quick Start (Fill In Once Tooling Exists)

- Install dependencies: `<TBD>`
- Build: `<TBD>`
- Lint: `<TBD>`
- Format: `<TBD>`
- Test (all): `<TBD>`
- Test (single): `<TBD>`

Common single-test patterns by ecosystem (replace with your actual commands):

- JavaScript/TypeScript (Vitest): `vitest path/to/test.test.ts -t "test name"`
- JavaScript/TypeScript (Jest): `jest path/to/test.test.ts -t "test name"`
- JavaScript/TypeScript (Playwright): `playwright test path/to/spec.spec.ts -g "name"`
- Python (pytest): `pytest path/to/test_file.py -k "expr"`
- Go: `go test ./path -run TestName`
- Rust: `cargo test test_name --package crate --lib`
- Java (Maven): `mvn -Dtest=MyTest test`
- Java (Gradle): `./gradlew test --tests "pkg.MyTest"`
- Ruby (RSpec): `bundle exec rspec spec/file_spec.rb:123`

---

## Code Style (Starter Guidance)

Until the repo defines its own conventions, prefer these safe defaults:

### Formatting

- Keep diffs small; avoid unrelated reformatting.
- Prefer the project's formatter once present (e.g., Prettier, Black, gofmt, rustfmt).
- Line length: follow formatter defaults; if none, keep lines reasonably short.

### Imports

- Group imports in this order when the language supports it:
  1) standard library
  2) third-party deps
  3) internal/modules
- Use absolute imports if the project is structured for it; otherwise follow existing.
- Sort imports (and remove unused) with the ecosystem tool once present.

### Naming

- Use the predominant naming convention of the language/framework.
- Prefer descriptive names over abbreviations.
- Avoid single-letter names except for tight/local scopes (e.g., indices).

### Types

- Prefer explicit types at module boundaries (public APIs, exported functions).
- Keep internal types inferred where it improves readability.
- Avoid `any`/dynamic escapes unless necessary; document why.

### Error Handling

- Return/throw errors early; keep the happy path left-aligned.
- Include actionable context in errors (operation + key identifiers).
- Don’t swallow errors; either handle or propagate.
- Keep error messages stable if they’re user-facing or asserted in tests.

### Logging

- Log at boundaries (request handling, job execution, integrations).
- Avoid logging secrets (tokens, passwords, cookies, raw credentials).
- Prefer structured logging where supported (key/value fields).

### Testing

- Write tests that assert behavior, not implementation details.
- Use focused unit tests; add integration/e2e tests for critical flows.
- Keep tests deterministic; avoid sleeps; use fakes/mocks where appropriate.

---

## Cursor/Copilot Rules

No Cursor rules found (no `.cursor/rules/` or `.cursorrules`).
No Copilot instructions found (no `.github/copilot-instructions.md`).

If you add them later, summarize the key constraints here and link to the files.

---

## When You Populate This Repo

Update this file by:

- Listing the exact commands from `package.json` scripts, `Makefile`, `pyproject.toml`, etc.
- Adding the canonical “single test” invocation used by the repo.
- Extracting style rules from linters/formatters (ESLint/Prettier, Ruff/Black, etc.).
- Capturing any architectural rules (layering, module boundaries, API patterns).
