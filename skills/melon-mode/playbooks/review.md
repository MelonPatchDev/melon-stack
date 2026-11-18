# Review (M and H tiers)

**You commit to what "done" means before the code exists, then judge the code against it.** You never wrote the change. You block only on problems you can show.

## Phase 1: the test plan (before code)
1. Read the issue, its brief and comments, and the code it will touch. Pull anything else only where needed.
2. **H tier: check the design.** Verify each claim the brief makes about the code (`file:line`), and walk the change as each persona to find the edge cases the brief missed. A wrong claim goes at the top of your plan as a blocking question.
3. Post a comment on the **issue** that starts with `TEST PLAN` (template: `templates/test-plan.md`). It's your reading of the task: ≤25 lines, one line per case:
   `T<n> · <observable behaviour> · <unit | property | golden | UI> · <why: acceptance criterion / rules § / ground rule>`
   - Cover each acceptance criterion, the edge cases where the behaviour needs a decision, and the failure modes: empty, unknown, missing data, unauthorised.
   - **Formula code:** compute golden values by hand for 2–4 small cases and put them in the plan.
   - Name anything you think the issue leaves unclear. The builder answers it in its reply.
   - **Predict the system effect** in one line: the state, contracts and data paths this work should need (melon-mode, the change questions). Phase 2 compares the diff against it.
4. **End your turn** with one line: `TEST PLAN POSTED #<n>`. Don't wait inside the turn or poll for the builder's reply; the orchestrator wakes you. If the builder replies `PLAN DIFFERS`, the orchestrator brings you its points: answer each in one comment, then end your turn again. Anything still open is the orchestrator's call.

## Phase 2: the verdict (when the orchestrator sends the PR)
1. Run `melon focus <pr>`. It lists the **focus files** (systemic paths, rule edits, held hotspots).
   - **H:** read the focus files in depth (`melon focus <pr> --diff`) and skim the rest (`gh pr diff <pr> --name-only`, then open only what a plan case points to).
   - **M:** read the whole diff at normal depth.
   - Don't re-run the full suite; the builder ran it, and CI runs once.
   - **Before reading the PR's Impact,** write your own System line from the diff: every new place for state, contract, data path, extension point or product-specific case. Then compare it with your phase-1 prediction and the builder's answer. Something in the diff that nobody named is a **blocking finding, with the diff as proof**. More than you predicted is scope creep: a note.
2. **Plan coverage:** for each T<n>, find the test (`file:line`) and confirm it asserts the agreed behaviour, not a weaker one. A missing or weakened case is blocking.
3. **What tests can't express**, read in the diff:
   - the ground rules;
   - auth guards on new routes;
   - glossary terms;
   - the rules doc updated together with any rule or formula change;
   - the Decisions with their bases, and **each graduation real**: `D<n> → <where>` points at a test, type or rule that would fail or object if the decision were reversed. `melon gate` only checks that the file and line exist; whether they actually protect the decision is your call;
   - **no silent reversal:** the change contradicts no open decision-log entry, ground rule or rules-doc line without listing it under Decisions (with `owner-review`). A PR that edits or deletes an existing test's assertion is reversing whatever that test protects; it must say so;
   - Impact claims true against the code. An overstated or missing UX effect is blocking.
   - **Patterns:** a new pattern that contradicts a line of the design intent you can quote is blocking. Any other pattern question is a note; taste never blocks.
   - **Fragment check:** could this have been part of another open or planned PR? One issue should be one complete slice.
4. **UI changes: walk it as each persona.** Take each user story, as each persona, through the screens as the code defines them. Report where they'd stall, misread a figure, or find a step heavy.
5. **Targeted probes only:** run the specific tests you doubt, or a one-off script for a suspected bug. A suspicion without a run is a note, not a blocker.
6. **Blocking needs proof:** a failing test or run at this head, or a line of a spec or ground rule the change breaks (quote it). Everything else is a non-blocking note or a `found-by-agent` issue.
7. Post the verdict on the PR (template: `templates/review-verdict.md`). The first line is exactly:
   `REVIEW VERDICT: APPROVE @ <head sha>` or `REVIEW VERDICT: CHANGES @ <head sha>`
   then each T<n> with ✓/✗ and `file:line`, the blocking findings with their proof, and your role tag on the last line. Final reply to the orchestrator: one line per finding.
8. **Re-check after a fix round:** check only what changed (`git diff <old sha>..<new sha>`) against the findings, then post a new verdict. The latest one counts. Merging `main` in doesn't cost a new verdict; `melon gate` knows that.
