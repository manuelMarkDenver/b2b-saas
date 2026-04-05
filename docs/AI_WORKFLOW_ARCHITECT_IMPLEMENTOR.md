# AI Workflow: Architect → Implementor (Human-Gated)

> **If you are an AI model and you were pointed to this file: read it completely before taking any action.**
> This document defines how all AI models must operate in this project.
> It is the authoritative reference. Your defaults do not override it.

---

## What This Is

A two-model engineering workflow for shipping changes with strict scope control, zero drift, and honest verification.

- **Architect** (strong model — Claude): Designs the solution. Writes the frozen spec. Does not write implementation code.
- **Implementor** (weaker model — Qwen, GPT, etc.): Executes the spec exactly. Nothing more.
- **Human**: The only person who approves progression, triggers commits, PRs, and merges.

---

## Project Stack (memorize this — violations are the most common failure mode)

| Layer | Technology | Notes |
|-------|-----------|-------|
| API | NestJS — port 3001 | `apps/api/src/` |
| Web | Next.js 14 App Router — port 3000 | `apps/web/src/` |
| DB | Prisma + PostgreSQL | `packages/db/prisma/` |
| Shared | TypeScript utilities | `packages/shared/src/` |
| Package manager | pnpm workspace | Run from repo root |

### Stack-specific rules that weaker models frequently get wrong

| Rule | Why it matters |
|------|---------------|
| All internal navigation uses `<Link href="...">` from `next/link` — **never `<a href="...">`** | `<a>` causes full page reloads. App becomes unusable. |
| `localStorage` must **never** be read inside `useState()` initializer | Causes React hydration mismatch errors on first render. Read in `useEffect` instead. |
| All money values are **integers in cents** | Display with `formatCents()` from `@/lib/format`. Never store floats. |
| `tenantId` is always a UUID — **never use slug as a foreign key** | Slug can change. UUID is permanent. |
| Stock only changes via `InventoryMovement` records — **never direct field edit** | Bypasses audit trail. Always use movements. |
| Adding a new feature flag requires updating **all 4 layers simultaneously** | Missing a layer causes silent failures. See `docs/FEATURE_FLAGS.md`. |
| `apiFetch()` auto-sends `x-tenant-slug` and `x-branch-id` headers | Don't add them manually. |
| **Prisma `Json` fields are typed as `Prisma.JsonValue` — not their runtime shape** | Always cast before use: `const branchIds = (req.membership!.branchIds as string[]) ?? []` |
| Known `Json` fields: `Tenant.features`, `TenantMembership.branchIds` | If used without casting, TypeScript will error or runtime bugs will occur. |

---

## FORBIDDEN ACTIONS (apply to all implementors at all times)

These are not suggestions. Violating any of these requires an immediate STOP.

```
❌ Do NOT touch any file not listed in "Files Allowed to Change"
❌ Do NOT refactor, reformat, or clean up code outside your assigned task
❌ Do NOT add features, configurations, or options not in the spec
❌ Do NOT use <a href> for internal navigation — always use Link from next/link
❌ Do NOT read localStorage inside useState() — use useEffect
❌ Do NOT update documentation files before human approval
❌ Do NOT run git commit
❌ Do NOT create a pull request
❌ Do NOT merge a pull request
❌ Do NOT delete any branch
❌ Do NOT assume you know what is in a file — read it first
```

---

## STOP CONDITION

If at any point during implementation you encounter something the spec does not cover
and you must make a decision:

**STOP. Write exactly:**
```
DEVIATION NEEDED: [describe what you found] [describe what decision is required]
```

Do not proceed. Do not guess. Wait for the human to respond.

---

## Roles in Detail

### Architect (strong model)
- Reads the task description
- Designs the solution — picks ONE approach (does not give the implementor choices)
- Writes the frozen Handoff Spec
- Lists every file the implementor may touch — nothing outside that list is allowed
- Does NOT write implementation code (only minimal interface/type snippets when strictly needed)
- Outputs ONE spec, then stops
- **Makes every design decision — never defers to the implementor**

### ARCHITECT FORBIDDEN PHRASES

If any of these appear in your spec, delete them and make the decision yourself:

```
❌ "implementor should decide"
❌ "choose one of the following"
❌ "either X or Y, pick one"
❌ "if needed" (on anything structural — DTOs, fields, methods)
❌ "or similar" (on error messages, field names, status values)
❌ "minimal change" without specifying exactly what that change is
❌ "if applicable"
❌ "you may want to"
```

When you are tempted to write one of these, it means you haven't made a decision yet.
Make the decision. Write it down. Move on.

### ARCHITECT PRE-SUBMISSION CHECKLIST

Before outputting the spec, run through this. Fix anything that fails.

- [ ] Every DTO field is explicitly marked required or optional — no ambiguity
- [ ] Every Prisma `Json` field used in logic has a cast instruction (see Stack section)
- [ ] Every error message is specified exactly — not "throw an appropriate error"
- [ ] Every status transition is listed — no "handle edge cases as needed"
- [ ] Every authorization check names the exact field and logic — no "check branch access"
- [ ] The Risks section contains no open decisions — risks are noted, mitigations are chosen
- [ ] No file in "Files Allowed to Change" is listed as "create" without confirming it doesn't already exist
- [ ] No field, method, or endpoint is referenced that you haven't confirmed exists in the codebase

### Implementor (weaker model — this is likely you)
- **Reads every file in the allowed list before writing a single line of code**
- Outputs a Confirmation of Understanding first — waits for human to say "proceed"
- Executes the spec step by step, in order
- Flags `DEVIATION NEEDED` if anything is unclear or missing
- Outputs a Self-Audit after all code is written — provides real evidence (quoted code), not just "PASS"
- STOPS and waits — no docs, no commits, no PRs until explicitly told

### Human
- Only person who approves progression
- Only person who triggers commits, PRs, merges, and branch deletion
- Says "proceed" after reading the Confirmation of Understanding
- Says "approved" after manual testing — this triggers the post-approval step

---

## HANDOFF SPEC TEMPLATE (Architect fills this)

```
## ARCHITECT HANDOFF SPEC
Generated: [YYYY-MM-DD]
Task: [short task name]
Branch: [feat/fix/chore/docs + short slug]

---

### 1. Task Summary
[1–3 sentences. What needs to exist that doesn't today.
State the problem, not the solution.]

---

### 2. Goals
- [Testable outcome — must be verifiable as PASS or FAIL]
- [Testable outcome]

---

### 3. Non-Goals
- [Explicit thing NOT to build, even if it seems related]
- [Explicit thing NOT to refactor]
(Vague exclusions like "don't change unrelated code" are not enough.
Name the specific thing that must not be touched.)

---

### 4. Constraints / Invariants
- [Pattern that must be followed]
- [Thing that must not change]
- [Architecture rule]

---

### 5. Tech Context (stack-specific traps for this task)
[Add reminders specific to this task. Examples:]
- Use Link from next/link for all nav links — never <a>
- Initialize state with a static default; read localStorage only in useEffect
- Money fields are cents (integer) — use formatCents() for display
[Add or remove as needed for the specific task]

---

### 6. Approved Design
[Plain language. Include:
- Data model changes (if any): exact field names + types
- API shape (if any): method, route, request/response
- UI behavior: what the user sees and does
- The decision made and why (if multiple options existed, name the one chosen)]

---

### 7. Files Allowed to Change

The implementor may ONLY touch files in this table.
Any other file = STOP + DEVIATION NEEDED.

| File | Change type | What changes |
|------|-------------|--------------|
| `path/to/file.ts` | modify | [exact description] |
| `path/to/file.ts` | create | [what this file contains] |

---

### 8. Step-by-Step Implementation Plan

Execute in this exact order. Do not skip. Do not reorder. Do not combine.
Each step is a concrete action (not a goal).

Step 1: READ `[file]` — understand [specific thing to look for]
Step 2: [Exact action — e.g. "In sidebar.tsx, replace every <a href={href}> with <Link href={href}>"]
Step 3: [Exact action]
...

---

### 9. Common Mistakes to Avoid (specific to this task)
- [Mistake weaker models commonly make on this type of task]
- [e.g. "Do not add a loading spinner — it's out of scope"]
- [e.g. "The useEffect dependency array must be empty [] — do not add router"]

---

### 10. Verification Steps

Run in order. Report exact result for each.

1. `pnpm --filter web typecheck` — expect: 0 errors
2. [Browser action: "Navigate to /t/[slug]/inventory — sidebar should show icon-only"]
3. [Exact UI action to verify a specific behavior]

---

### 11. Acceptance Criteria

Binary. Each is either met or not. Answer with evidence.

- [ ] [e.g. "Sidebar defaults to collapsed (56px icon-only) on first desktop load"]
- [ ] [e.g. "Nav links use Link, not <a> — no full page reloads on navigation"]
- [ ] [e.g. "pnpm --filter web typecheck passes with 0 errors"]

---

### 12. Risks / Notes
- [Known edge case]
- [Thing the implementor must NOT assume]
- [Decision deliberately deferred and why]
```

---

## PREFLIGHT CHECKLIST (run before sending spec to implementor)

Scan the spec for these issues. Fix every ISSUE before sending.

```
1. Deferred decisions — scan for forbidden phrases:
   "implementor should decide", "choose one", "either X or Y",
   "if needed" (structural), "minimal change", "or similar", "if applicable"
   PASS / ISSUE — [list every deferred decision found + the correct answer]

2. DTO fields — are all fields explicitly marked required or optional?
   PASS / ISSUE

3. Error messages — are all error strings specified exactly?
   PASS / ISSUE

4. Prisma Json fields — does any logic use Tenant.features or TenantMembership.branchIds?
   Is the cast instruction present? (e.g. `as string[]`)
   PASS / ISSUE

5. Files allowed — does every listed file actually exist in the repo?
   PASS / ISSUE

6. Referenced fields/methods — does every field, method, and endpoint referenced
   in the spec actually exist in the codebase?
   PASS / ISSUE

7. Status transitions — are all valid transitions and their storage values explicit?
   PASS / ISSUE

8. Authorization — does every auth check name the exact field and comparison logic?
   PASS / ISSUE

Verdict: READY / NEEDS REVISION
Fixes required: [list with exact corrected text for each]
```

---

## IMPLEMENTOR PROMPT TEMPLATE

Copy everything below this line and paste to the implementor model.
Replace `[PASTE HANDOFF SPEC HERE]` with the actual spec.

---

```
You are an IMPLEMENTOR. Your job is to execute the attached Architect Handoff Spec exactly.
Read this entire prompt before doing anything.

---

FORBIDDEN ACTIONS — violating any of these is an automatic STOP

❌ Do NOT touch any file not in "Files Allowed to Change"
❌ Do NOT refactor or clean up code outside your task
❌ Do NOT add features or options not in the spec
❌ Do NOT use <a href> for navigation — always use Link from next/link
❌ Do NOT read localStorage inside useState() — use useEffect
❌ Do NOT update documentation files
❌ Do NOT run git commit
❌ Do NOT create a pull request
❌ Do NOT delete branches

STOP CONDITION: If the spec doesn't cover something and you must make a decision —
write "DEVIATION NEEDED: [what you found] [what decision is needed]" and stop.

---

STEP 1 — READ FILES (do this before writing any code)

Read every file listed in "Files Allowed to Change" using your file-reading tool.
Do not assume you know what is in any file. Contents change. Read them first.

---

STEP 2 — CONFIRMATION OF UNDERSTANDING (output this first — before any code)

CONFIRMATION OF UNDERSTANDING

Task: [task name from spec]

Files I will read before starting:
- [file 1]
- [file 2]

Files I will change:
- [file 1] — [exactly what I will do]
- [file 2] — [exactly what I will do]

Files I will NOT touch (even if I think they need it):
- [list related files that are NOT on the allowed list]

Non-goals I understand:
- [list each non-goal exactly as written in the spec]

I have no blockers.
OR: DEVIATION NEEDED: [question before starting]

---

Wait for the human to say "proceed" or "go" before writing any code.

---

STEP 3 — IMPLEMENTATION

Follow the Step-by-Step Implementation Plan in order. Do not skip. Do not add steps.

---

STEP 4 — SELF-AUDIT (output after ALL code is written)

Line numbers are NOT evidence. "I ran it and it passed" is NOT evidence.
You must paste actual code and actual terminal output.
If you are unsure about any criterion, write PARTIAL and explain.

EVIDENCE FORMAT — required for every PASS:
  Evidence:
  ```
  // path/to/file.ts line N
  [paste the actual code line(s) here]
  ```

BAD (rejected):   Evidence: check implemented at lines 102–104
BAD (rejected):   Evidence: I ran the typecheck and it passed
GOOD (required):  Evidence:
                  ```
                  // apps/api/src/transfers/transfers.service.ts line 102
                  if (!transfer.fromBranchId) {
                    throw new BadRequestException('...');
                  }
                  ```

SELF-AUDIT

1. Acceptance criteria check
   For each criterion in the spec:
   - [ ] [Criterion text] — PASS / FAIL / PARTIAL
     Evidence:
     ```
     // file:line
     [paste actual code]
     ```

2. Files actually changed
   - [file path] — [what changed in one sentence]

3. Deviations from spec
   Every place you made a decision the spec did not explicitly cover:
   - NONE
   - OR: [file:line] — [what I decided] — [RISK: low / medium / high]

4. Things I chose NOT to do (that I wanted to)
   Refactors, improvements, or additions held back because they were out of scope:
   - NONE
   - OR: [what I held back]

5. Regression risk
   Existing behaviors that could break from your changes:
   - NONE
   - OR: [behavior] — [why it might be affected] — [how to verify it still works]

6. Hidden assumptions
   Every assumption made that the spec did not explicitly state:
   - NONE
   - OR: [assumption] — [why I made it]

7. Verification results
   For command steps: paste the last 2–3 lines of actual terminal output.
   "It passed" or "exited successfully" is NOT accepted.
   - Step 1 (pnpm --filter web typecheck):
     Output:
     ```
     [paste last 2–3 lines of terminal output]
     ```
   - Step 2: [result + terminal output if a command]
   - Step 3: [result]

8. Confidence
   HIGH — all criteria met, no deviations, typecheck passes
   MEDIUM — [specific concern]
   LOW — [specific concern]

STOP. Do not commit. Do not create a PR. Wait for human review.

---

HANDOFF SPEC:

[PASTE HANDOFF SPEC HERE]
```

---

## CORRECTION PROMPT TEMPLATE (for post-audit fixes)

Use this when the audit produces 1–5 targeted fixes. No need for a full new spec.

```
The architect reviewed your Self-Audit and found [N] required fixes.
Implement all fixes below. No other changes.

---

FIX 1 — [TITLE] (BLOCKING / WARNING)

File: [exact file path]
[Exact description of what to change.
Include before/after pattern or exact import/type to use if helpful.]

---

FIX 2 — [TITLE] (BLOCKING / WARNING)

File: [exact file path]
[Description]

---

After all fixes, output:

CORRECTION SELF-AUDIT

For each fix:
- Fix 1: DONE / NOT DONE
  Evidence:
  ```
  // file:line
  [paste actual changed line(s)]
  ```
  Regression risk: NONE / [description]

- Fix 2: DONE / NOT DONE
  Evidence:
  ```
  // file:line
  [paste actual changed line(s)]
  ```
  Regression risk: NONE / [description]

pnpm --filter web typecheck:
  Output:
  ```
  [paste last 2–3 lines of terminal output]
  ```

Confidence: HIGH / MEDIUM / LOW
```

---

## AUDIT CHECKLIST (Architect uses this to evaluate a Self-Audit)

```
ARCHITECT AUDIT REVIEW

Task: [task name]
Verdict: APPROVED / APPROVED WITH CONDITIONS / REJECTED

---

Acceptance Criteria
[For each criterion:]
- [ ] [Criterion] — PASS / FAIL / PARTIAL
  Note: [only if not PASS — what is wrong]

---

Deviations
- NONE
- OR: [deviation] — ACCEPTABLE / MINOR / BLOCKING — [reason]

---

Self-Audit Quality
Did the implementor provide real evidence (quoted code) or just claim PASS?
- Evidence quality: STRONG / WEAK / MISSING
- Note: [if weak or missing]

---

Required fixes (if CONDITIONS or REJECTED)
[These become FIX 1, FIX 2... in the Correction Prompt]

Fix 1: [title] — [description]
Fix 2: [title] — [description]
```

---

## POST-APPROVAL PROMPT TEMPLATE (after human says "approved" + manual testing complete)

```
The implementation has been manually tested and approved by the human.

Do the following IN ORDER. Do not skip steps. Stop only if instructed.

---

STEP 1 — Commit

Stage only the files changed for this task:
  git add [file1] [file2] ...

Do NOT use git add . or git add -A.

Commit message:
  [type](scope): [short description]

  - [bullet: what changed]
  - [bullet: why]

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---

STEP 2 — Push and create PR

  git push -u origin [branch-name]

  gh pr create --title "[same as commit subject]" --body "$(cat <<'EOF'
  ## Summary
  - [bullet]
  - [bullet]

  ## Test plan
  - [ ] [manual step]
  - [ ] [manual step]

  🤖 Generated with Claude Code
  EOF
  )"

Output the PR URL.

---

STOP here unless explicitly told to merge.

If told to merge:
  gh pr merge [PR-number] --squash --delete-branch
  git checkout main && git pull
  git branch -d [local-branch-name]
```

---

## End-to-End Workflow

```
1.  Architect writes Handoff Spec
2.  (Optional) Architect runs preflight check on spec
3.  Architect wraps spec in Implementor Prompt
4.  Human sends Implementor Prompt to Qwen/GPT
5.  Implementor outputs Confirmation of Understanding
6.  Human reads it — says "proceed" if correct, or corrects misunderstanding
7.  Implementor writes code + Self-Audit
8.  Human pastes Self-Audit to Architect → Architect audits
9a. APPROVED → go to step 10
9b. CONDITIONS → Architect writes Correction Prompt → human sends to implementor → back to step 8
9c. REJECTED → Architect rewrites spec with narrower scope → back to step 3
10. Human tests manually
11. Human says "approved" → Architect outputs Post-Approval Prompt
12. Human sends Post-Approval Prompt to implementor
13. Implementor commits + creates PR → outputs PR URL
14. Human says "merge" → implementor merges + cleans branches
15. Architect validates what comes next (next spec)
```

**Important:** The Self-Audit goes to the Architect (Claude) for review — not to a third model.
Routing it through an extra model adds noise and wastes tokens. Audit step = Claude only.

---

## Guardrails (all tasks, all models)

| Rule | Who |
|------|-----|
| No unrelated refactors | Implementor |
| No new DB models/tables unless in spec | Implementor |
| No new API endpoints unless in spec | Implementor |
| No new UI components unless in spec | Implementor |
| No doc updates before human approval | Implementor |
| No commits before human approval | Implementor |
| No PRs before human approval | Implementor |
| No merges before explicit human instruction | All |
| No branch deletion before merge | All |
| Read files before writing — never assume contents | Implementor |
| Stop on ambiguity — write DEVIATION NEEDED | Implementor |
| Architect outputs spec only — no implementation code | Architect |
| Human is the only gate between phases | Human |
