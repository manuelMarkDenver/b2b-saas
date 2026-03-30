# /playwright — Run & Interpret Browser Tests

Run Playwright browser tests and produce a structured results report.

## Steps

1. **Check server**: Verify the dev server is running. If not, remind the user to start it with `pnpm dev` in `apps/web/` (or set `CI=true` to skip webServer). Playwright needs a live server unless `CI=true`.

2. **Determine scope**: Based on recent changes, decide which spec files to run:
   - If a specific page changed → run its spec file only (e.g., `e2e/orders.spec.ts`)
   - If layout/shell changed → run `e2e/navigation.spec.ts` + `e2e/mobile-responsive.spec.ts`
   - If unsure or doing a full audit → run all specs

3. **Run the tests**:
   ```bash
   cd apps/web && pnpm test:e2e
   ```
   Or for a specific file:
   ```bash
   cd apps/web && npx playwright test e2e/orders.spec.ts
   ```
   Or for a specific project (desktop only, mobile only):
   ```bash
   cd apps/web && npx playwright test --project=desktop-chrome
   cd apps/web && npx playwright test --project=mobile-chrome
   ```

4. **Interpret results** using the format below.

---

## Output Format

### ✅ Passed / ❌ Failed / ⚠️ Skipped

List each test with its result. For failures, include:
- **Test name**
- **Error message** (exact Playwright error)
- **Likely cause** (selector mismatch, timing, wrong text, layout change)
- **Suggested fix**

### Summary Table

| Suite | Passed | Failed | Skipped |
|-------|--------|--------|---------|
| dashboard | N | N | N |
| orders | N | N | N |
| payments | N | N | N |
| inventory | N | N | N |
| reports | N | N | N |
| catalog | N | N | N |
| settings | N | N | N |
| navigation | N | N | N |
| pwa | N | N | N |
| auth | N | N | N |
| mobile-responsive | N | N | N |

If all tests pass: **✅ All browser tests passing.**
If any fail: **🚫 N test(s) failing — fix before committing.**

---

## Spec File Reference

| File | Covers |
|------|--------|
| `e2e/auth.spec.ts` | Login, invalid creds, redirect |
| `e2e/dashboard.spec.ts` | Heading, stat cards, date picker, mobile |
| `e2e/orders.spec.ts` | Table columns, New Order, sheet, mobile scroll |
| `e2e/payments.spec.ts` | Tabs, payables, payments history, mobile scroll |
| `e2e/inventory.spec.ts` | Stock levels, movements, log movement dialog, mobile scroll |
| `e2e/reports.spec.ts` | Heading, date picker, Export CSV, table columns, mobile scroll |
| `e2e/catalog.spec.ts` | Products, SKUs, CSV import, download template |
| `e2e/settings.spec.ts` | Profile, team members, nav links, mobile horizontal nav |
| `e2e/navigation.spec.ts` | Sidebar links, breadcrumbs, mobile drawer open/close |
| `e2e/pwa.spec.ts` | manifest.json, icons, offline page, viewport meta |
| `e2e/mobile-responsive.spec.ts` | Sidebar drawer, overlay, desktop inline collapse |

---

## Common Failure Patterns

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `Timeout waiting for element` | Slow API / missing data seed | Check seed is populated; increase timeout |
| `Expected N to be visible` | Text/selector changed in component | Update spec to match new selector |
| `Expected scrollable to be true` | `overflow-x-auto` removed from outer card | Re-add overflow class to table card |
| `URL did not match /t\/.+/` | Auth broken / redirect not happening | Check JWT cookie / login flow |
| `Expected heading 'X' to be visible` | Page heading text changed | Update `getByRole('heading', { name: '...' })` in spec |
