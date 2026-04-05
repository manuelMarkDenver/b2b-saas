# /arch-flow — Architect → Implementor Workflow

Two-model engineering workflow. Claude (you) is the Architect. Qwen/GPT/weaker model is the Implementor.
Optimizes for: scope discipline, zero drift, honest self-audit, token efficiency.

---

## MODES

```
/arch-flow architect    — describe the task; outputs the Handoff Spec
/arch-flow preflight    — paste a Handoff Spec; reviews it for gaps before sending to implementor
/arch-flow implementor  — paste the Handoff Spec; outputs the ready-to-send Implementor Prompt
/arch-flow fix          — list the fixes needed; outputs a tight Correction Prompt (no full spec needed)
/arch-flow audit        — paste the implementor's Self-Audit; evaluates it and gives verdict
/arch-flow approve      — implementation is accepted; outputs Post-Approval Prompt
/arch-flow next         — validate what comes next; output the next Handoff Spec
```

If no mode is given, default to `architect`.

---

## ROLES

**Architect (Claude — this model)**
- Reads the task, designs the solution, writes the frozen spec
- Lists every file the implementor may touch — nothing else is allowed
- Does NOT write implementation code (only interface/type snippets when strictly needed for clarity)
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
- [ ] Every Prisma `Json` field used in logic has a cast instruction (see Tech Context)
- [ ] Every error message is specified exactly — not "throw an appropriate error"
- [ ] Every status transition is listed — no "handle edge cases as needed"
- [ ] Every authorization check names the exact field and logic — no "check branch access"
- [ ] The Risks section contains no open decisions — risks are noted, mitigations are chosen
- [ ] No file in "Files Allowed to Change" is listed as "create" without confirming it doesn't already exist
- [ ] No field, method, or endpoint is referenced that you haven't confirmed exists in the codebase

**Implementor (Qwen, GPT, weaker model)**
- Reads files before writing anything — never assumes file contents
- Confirms understanding BEFORE writing code
- Executes the spec exactly — no redesign, no extras, no cleanup outside scope
- Flags `DEVIATION NEEDED` if spec is ambiguous — does not guess
- Runs Self-Audit after implementation — answers honestly, quotes actual code
- STOPS and waits — no docs, no commits, no PRs without explicit human instruction

**Human (you)**
- Only person who approves progression between phases
- Only person who triggers commits, PRs, merges, and branch deletion

---

## MODE: architect

Read the task description. Output the Handoff Spec below. Do not output implementation code.

---

### HANDOFF SPEC TEMPLATE

```
## ARCHITECT HANDOFF SPEC
Generated: [date]
Task: [short task name]
Branch: [suggested branch name, e.g. feat/sidebar-redesign]

---

### 1. Task Summary
[1–3 sentences. What needs to exist that doesn't today. State the problem, not the solution.]

---

### 2. Goals
- [Testable outcome 1]
- [Testable outcome 2]
(Each item must be something that can be verified as PASS or FAIL.)

---

### 3. Non-Goals
- [Explicit thing NOT to build, even if it seems related]
- [Explicit thing NOT to refactor]
(Be specific. "Don't change unrelated code" is not enough.)

---

### 4. Constraints / Invariants
- [Pattern that must be followed — e.g. "all money is in cents (integer)"]
- [Thing that must not change — e.g. "do not change the Sidebar props interface beyond what is listed"]
- [Architecture rule — e.g. "stock only changes via InventoryMovement, never direct field edit"]

---

### 5. Tech Context (READ THIS — it prevents common mistakes)
- Stack: NestJS API (port 3001) + Next.js 14 App Router (port 3000) + Prisma + Postgres
- All nav links in Next.js must use `<Link>` from `next/link` — never `<a>` (causes full page reload)
- localStorage must NOT be read inside `useState()` initializer — causes hydration mismatch. Read in `useEffect` instead.
- All money values are integers in cents. Display with `formatCents()` from `@/lib/format`.
- `tenantId` is always a UUID — never use slug as a foreign key
- Feature flags: adding a new flag requires updating ALL 4 layers (see FEATURE_FLAGS.md)
- `apiFetch()` auto-sends `x-tenant-slug` and `x-branch-id` headers from localStorage
- **Prisma `Json` fields are typed as `Prisma.JsonValue` in TypeScript — not as their runtime shape.**
  Always cast before use. Example: `const branchIds = (req.membership!.branchIds as string[]) ?? [];`
  Fields in this project that require casting: `Tenant.features`, `TenantMembership.branchIds`
- `req.membership` is typed as `TenantMembership | undefined` — includes all Prisma model fields
- `req.tenant` is typed as `Tenant | undefined` — includes all Prisma model fields
[Add task-specific reminders here.]

---

### 6. Approved Design
[Plain language description of the solution. Include:
- Data model changes (if any) — exact field names and types
- API shape (if any) — method, route, request/response shape
- UI behavior — what the user sees and does
- Key decision made and why (if there were two options, say which was chosen and why)]

---

### 7. Files Allowed to Change

IMPORTANT: The implementor may ONLY touch files listed here.
Any unlisted file requires a STOP and DEVIATION NEEDED notice.

| File | Change type | What changes |
|------|-------------|--------------|
| `path/to/file.ts` | modify | [exact description of what changes] |
| `path/to/file.ts` | create | [what this file is and what goes in it] |

---

### 8. Step-by-Step Implementation Plan

Execute in this exact order. Do not skip steps. Do not reorder.

1. READ `[file]` — understand [what to look for]
2. [Concrete action, e.g. "In `sidebar.tsx`, replace the `<a href={href}>` element with `<Link href={href}>`"]
3. [Concrete action]
...

(Each step is an action, not a goal. "Make the sidebar work" is not a step. "Replace line X with Y" is.)

---

### 9. Common Mistakes to Avoid
- [Mistake weaker models make on this type of task]
- [e.g. "Do not initialize state from localStorage inside useState() — use useEffect"]
- [e.g. "Do not replace <Link> with <a> — this causes full page reloads"]

---

### 10. Verification Steps

Run these in order to confirm the implementation works.

1. `pnpm --filter web typecheck` — must pass with 0 errors
2. [Browser step: "Navigate to /t/[slug]/inventory — the sidebar should show icon-only by default"]
3. [Exact UI action to verify a specific behavior]
...

---

### 11. Acceptance Criteria

Binary. Each is either met or not.

- [ ] [Criterion — e.g. "Sidebar defaults to collapsed (56px) on first load"]
- [ ] [Criterion — e.g. "Navigating via sidebar does not cause full page reload"]
- [ ] [Criterion — e.g. "pnpm --filter web typecheck passes"]

---

### 12. Risks / Notes
- [Known edge cases]
- [Things the implementor must NOT assume]
- [Decisions deliberately deferred and why]
```

---

## MODE: preflight

Review the Handoff Spec for quality before it is sent to the implementor.
Check for gaps that would cause the implementor to stall, deviate, or produce wrong output.

Output:

```
PREFLIGHT REVIEW

1. Scope clarity — is the task boundary unambiguous?
   PASS / ISSUE — [description]

2. Non-goals — specific enough to prevent scope creep?
   PASS / ISSUE — [description]

3. Files allowed — do they match actual repo state? Any missing?
   PASS / ISSUE — [description]

4. Tech context — are there stack-specific traps the implementor needs to know?
   (Check specifically: Prisma Json fields, localStorage, Link vs <a>, money as cents)
   PASS / ISSUE — [description]

5. Implementation plan — is each step a concrete action (not a goal)?
   PASS / ISSUE — [description]

6. Deferred decisions — does the spec contain any decision left to the implementor?
   Scan for: "implementor should decide", "choose one", "either X or Y", "if needed",
   "minimal change", "or similar", "if applicable", "you may want to"
   PASS / ISSUE — [list every deferred decision found and the correct answer]

7. DTO fields — are all fields explicitly marked required or optional?
   PASS / ISSUE — [description]

8. Error messages — are all error strings specified exactly?
   PASS / ISSUE — [description]

9. JSON field casts — does any logic use a Prisma Json field? Is the cast specified?
   (Known Json fields: Tenant.features, TenantMembership.branchIds)
   PASS / ISSUE — [description]

10. Common mistakes — are the likely failure modes called out?
    PASS / ISSUE — [description]

11. Verification steps — executable with actual tooling?
    PASS / ISSUE — [description]

12. Acceptance criteria — each one binary and testable?
    PASS / ISSUE — [description]

13. Verdict
    READY / NEEDS REVISION

14. Required fixes (if NEEDS REVISION)
    For each fix, provide the exact corrected text — not just "fix this"
    - Fix 1: [section] — replace "[old text]" with "[exact corrected text]"
    - Fix 2: ...
```

---

## MODE: implementor

Output the prompt below, ready to copy-paste to the implementor model.
Replace `[PASTE HANDOFF SPEC HERE]` with the actual spec before sending.

---

### IMPLEMENTOR PROMPT

```
You are an implementor. Your job is to execute the attached Architect Handoff Spec exactly — nothing more, nothing less.

---

## BEFORE YOU WRITE A SINGLE LINE OF CODE

Read the entire spec.
Then read every file listed in "Files Allowed to Change" using your file-reading tool.
Do NOT assume you know what is in any file. File contents may have changed. Read them first.

---

## FORBIDDEN ACTIONS (non-negotiable)

❌ Do NOT touch any file not listed in "Files Allowed to Change"
❌ Do NOT refactor, reformat, or clean up code outside your task
❌ Do NOT add features, options, or configurations not in the spec
❌ Do NOT use <a href> for internal navigation in Next.js — always use Link from next/link
❌ Do NOT read localStorage inside useState() — use useEffect instead
❌ Do NOT update documentation files
❌ Do NOT run git commit
❌ Do NOT create a pull request
❌ Do NOT delete branches

---

## STOP CONDITION

If at any point you encounter something the spec does not cover and you must make a decision:
STOP. Write exactly: "DEVIATION NEEDED: [describe what you found and what decision is required]"
Do not proceed until the human responds.

---

## STEP 1 — CONFIRMATION OF UNDERSTANDING (output this FIRST, before any code)

```
CONFIRMATION OF UNDERSTANDING

Task: [task name from spec]

Files I will read before starting:
- [file 1]
- [file 2]

Files I will change:
- [file 1] — [exactly what I will do]
- [file 2] — [exactly what I will do]

Files I will NOT touch (even if I think they need it):
- [list files not on the allowed list that seem related]

Non-goals I understand:
- [list them exactly as written in the spec]

I have no blockers. / DEVIATION NEEDED: [question before starting]
```

Wait for the human to say "proceed" or "go" before writing any code.

---

## STEP 2 — IMPLEMENTATION

Follow the Step-by-Step Implementation Plan in the spec. Execute steps in order.

Do not skip a step. Do not combine steps. Do not add steps.

---

## STEP 3 — SELF-AUDIT (output this after ALL code is written)

Do not write PASS unless you paste the actual code. Line numbers are NOT evidence.
"I ran it and it passed" is NOT evidence. If you are unsure, write PARTIAL and explain.

EVIDENCE FORMAT — required for every PASS:
  Evidence:
  ```
  // file/path.ts line N
  [paste the actual code line(s) here]
  ```

BAD (not accepted):    Evidence: implemented at lines 102–104
BAD (not accepted):    Evidence: check occurs before the transaction
GOOD (required):       Evidence:
                       ```
                       // apps/api/src/transfers/transfers.service.ts line 102
                       if (!transfer.fromBranchId) {
                         throw new BadRequestException('Legacy transfers without a source branch cannot be sent');
                       }
                       ```

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
   List every file you modified or created:
   - [file path] — [what changed, in one sentence]

3. Deviations from spec
   List every place you made a decision the spec did not explicitly cover:
   - NONE
   - OR: [file:line] — [what I decided and why] — [RISK: low/medium/high]

4. Things I did NOT do (that I wanted to)
   List any refactors, improvements, or additions you chose not to make because they were out of scope:
   - NONE
   - OR: [what I held back]

5. Regression risk
   List existing behaviors that could break from your changes:
   - NONE
   - OR: [behavior] — [why it might be affected] — [how to verify it still works]

6. Hidden assumptions
   List every assumption you made that the spec did not explicitly state:
   - NONE
   - OR: [assumption] — [why I made it]

7. Verification results
   For each command verification step: paste the last 2–3 lines of actual terminal output.
   "It passed" or "exited successfully" is NOT accepted.
   - Step 1 (`pnpm --filter web typecheck`):
     Output:
     ```
     [paste last 2–3 lines of terminal output]
     ```
   - Step 2: [result + output if applicable]
   ...

8. Confidence level
   HIGH — all criteria met, no deviations, typecheck passes
   MEDIUM — [specific concern]
   LOW — [specific concern]
```

STOP here. Do not commit. Do not create a PR. Wait for human review.

---

## Handoff Spec

[PASTE HANDOFF SPEC HERE]
```

---

## MODE: fix

Use this mode when the audit produces 1–5 targeted fixes that don't need a full new spec.
Paste the list of required fixes. Output a compact Correction Prompt ready to send to the implementor.

Output:

```
CORRECTION PROMPT

The architect reviewed your Self-Audit and found [N] required fixes.
Implement all fixes below. No other changes.
After all fixes, output a Correction Self-Audit.

---

FIX [#] — [FIX TITLE] ([BLOCKING / WARNING])

File: [exact file path]
[Exact description of what to change. Be specific enough that there is only one way to interpret it.]
[If relevant: include the before/after pattern, or the exact import/type/class to use]

---

FIX [#] — [FIX TITLE] ([BLOCKING / WARNING])

...

---

After all fixes, output:

CORRECTION SELF-AUDIT

For each fix:
- Fix [#]: DONE / NOT DONE
  Evidence: [quote the exact changed line(s)]
  Regression risk: NONE / [description]

pnpm --filter web typecheck: PASS / FAIL — [first error if FAIL]

Confidence: HIGH / MEDIUM / LOW
```

---

## MODE: audit

Paste the implementor's Self-Audit (and optionally the original spec). Evaluate it.

Do not be agreeable. Assume the implementor said PASS when it might be PARTIAL.
Flag anything where the evidence quoted does not actually satisfy the criterion.

Output:

```
ARCHITECT AUDIT REVIEW

Task: [task name]
Verdict: APPROVED / APPROVED WITH CONDITIONS / REJECTED

---

Acceptance Criteria
[For each criterion:]
- [ ] [Criterion] — PASS / FAIL / PARTIAL
  Note: [only if not PASS — what is wrong or missing]

---

Deviations
- NONE
- OR: [deviation] — ACCEPTABLE / MINOR / BLOCKING — [reason]

---

Self-Audit Quality
Did the implementor provide real evidence (quoted code) or just claimed PASS?
- Evidence quality: STRONG / WEAK / MISSING
- Note: [if WEAK or MISSING — what was missing]

---

Required fixes before approval (if CONDITIONS or REJECTED)
[Use /arch-flow fix to generate the correction prompt for these]

Fix 1: [title] — [description]
Fix 2: [title] — [description]

---

Workflow note (if applicable):
[Any process issue — e.g. "implementor did not wait for proceed signal", "implementor touched unlisted file"]
```

---

## MODE: approve

Output the Post-Approval Prompt, ready to send to the implementor.
Fill in branch name and files before sending.

```
The implementation has been manually tested and approved.

Do the following steps IN ORDER. Stop between steps only if instructed.

---

STEP 1 — Commit

Stage only the files changed for this task:
git add [file1] [file2] ...

Do NOT use git add . or git add -A.

Commit message format:
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

Output the PR URL when done.

---

STOP here unless you were explicitly told to merge.

If told to merge:
gh pr merge [PR-number] --squash --delete-branch
git checkout main && git pull
git branch -d [local-branch-name]
```

---

## MODE: next

The implementor or human pastes a summary of what comes next.

1. Validate whether the next step is correct given current state
2. Output a Progress Summary
3. Wait for the human to confirm or adjust scope
4. Then output the next Handoff Spec

Progress Summary format:

```
## Progress Summary

| PR  | Title | Status |
|-----|-------|--------|
| #[n] | [title] | ✅ Merged / 🔄 Open / ❌ Rejected |

## Current Phase Status
[1–2 sentences on where we are in the phase map]

## Up Next

| # | Task | Depends on | Notes |
|---|------|-----------|-------|
| 1 | [next — current] | — | ← you are here |
| 2 | [following task] | Task 1 | |
| 3 | [following task] | Task 2 | |

> Confirm scope, add instructions, or say "go" to generate the next spec.
```

Wait for human confirmation before outputting the next spec.

---

## GUARDRAILS

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
| Stop and write DEVIATION NEEDED if spec is ambiguous | Implementor |
| Architect outputs spec only — no implementation code | Architect |
| Human is the only gate between phases | Human |
| Audit is done by Claude (Architect), not GPT | Human |
| Use /arch-flow fix for post-audit corrections — not a full new spec | Architect |

---

## WORKFLOW (end to end)

```
1. /arch-flow architect   → Claude outputs Handoff Spec
2. /arch-flow preflight   → Claude reviews spec for gaps (optional but recommended)
3. /arch-flow implementor → Claude wraps spec into Implementor Prompt
4. Human sends prompt to Qwen/GPT
5. Implementor outputs Confirmation of Understanding → human says "proceed"
6. Implementor outputs code + Self-Audit
7. Human pastes Self-Audit here → /arch-flow audit
8. Claude outputs verdict:
   - APPROVED → go to step 9
   - CONDITIONS → /arch-flow fix → human sends Correction Prompt to implementor → loop back to step 7
   - REJECTED → /arch-flow architect again with narrower scope
9. Human tests manually
10. Human says "approved" → /arch-flow approve → Claude outputs Post-Approval Prompt
11. Human sends Post-Approval Prompt to implementor → implementor commits + creates PR
12. Human says "merge" → implementor merges + cleans branches
13. /arch-flow next → Claude validates what comes next
```

**Note on GPT in the middle:** Do NOT send the Self-Audit to a third model for review.
The `/arch-flow audit` step IS the review. Sending it to GPT first adds tokens and noise.
Route Self-Audits directly here.

---

## QUICK REFERENCE

```
/arch-flow architect    → Handoff Spec from task description
/arch-flow preflight    → spec gap review before sending to implementor
/arch-flow implementor  → wraps spec into the ready-to-send Implementor Prompt
/arch-flow fix          → compact Correction Prompt for post-audit fixes (1–5 fixes, no full spec)
/arch-flow audit        → evaluate implementor's Self-Audit; give verdict
/arch-flow approve      → Post-Approval Prompt: commit + PR (+ merge if instructed)
/arch-flow next         → validate next task; output next Handoff Spec
```
