---
description: Mark a milestone as complete — updates MILESTONES.md DoD checklist and prompts for PR
argument-hint: <milestone-number> (e.g. 4, 5, 6)
---

Mark Milestone $ARGUMENTS as complete. Do the following:

1. Read `docs/MILESTONES.md` and locate the MS$ARGUMENTS section.
2. Verify all Definition of Done (DoD) checklist items are actually implemented by checking the relevant files — do NOT mark complete based on memory alone.
3. For any unchecked item, report what is missing.
4. If all DoD items are met:
   - Mark all checklist items as checked in `docs/MILESTONES.md`
   - Add a completion note with today's date
5. Check that the following docs are up to date for this milestone's changes:
   - `docs/DATA_MODEL.md`
   - `docs/ARCHITECTURE.md`
   - `docs/RULES.md`
   - `docs/MILESTONES.md`
6. Summarize what was completed in this milestone (2–4 bullet points).
7. Ask the user: "Ready to create the PR for MS$ARGUMENTS?"
8. If yes, prompt for PR creation using the standard format with a summary and test plan.
