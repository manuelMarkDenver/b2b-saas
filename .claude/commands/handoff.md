# /handoff — Context Limit Handoff Log

Generate a structured handoff log so the next conversation can resume without losing context. Run this when approaching the token/context limit (~80% usage).

## Instructions

Produce the following 6 sections in order. Be specific — this is the only record the next session will have.

---

## 1. Current Status

- What milestone/branch are we on right now?
- What was the last thing completed?
- What is the current git branch and its state (clean, uncommitted changes, unpushed commits)?

## 2. What We Were Doing

- The exact task in progress at the time this log was generated
- If mid-implementation: which files were being edited, what change was being made, and where it was left off
- If mid-debugging: what the error was, what was tried, what the next step was

## 3. Immediate Next Steps

List the next 3–5 concrete actions in order, specific enough that the next session can execute them without asking:
1. [Exact action]
2. [Exact action]
3. ...

## 4. Open Decisions

Any decisions that were deferred, discussed but not resolved, or that the user needs to make before work can continue. Include the options considered and any recommendation.

## 5. Pre-Staging Checklist Snapshot

Pull the current state of the pre-staging checklist from `docs/MILESTONES.md` and reproduce it here verbatim so the next session has it without needing to read the file.

## 6. Key Files Touched This Session

List every file that was created or modified this session with a one-line description of what changed. Format:

| File | Change |
|------|--------|
| `path/to/file.ts` | What was added/changed |

---

After producing the log, remind the user to:
1. Copy this log somewhere safe (Notion, notes, etc.) if they want — it will also be in the conversation transcript
2. Start a new conversation and paste: **"Resuming from handoff log. [paste log here]"**
