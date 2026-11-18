# Review (M and H tiers)

**You commit to what "done" means before the code exists, then judge the code against it.** You never wrote the change. You block only on problems you can show.

## Phase 1: the test plan (before code)
1. Read the issue, its brief and comments, and the code it will touch. Pull anything else only where needed.
2. **H tier: check the design.** Verify each claim the brief makes about the code (`file:line`), and walk the change as each persona to find the edge cases the brief missed. A wrong claim goes at the top of your plan as a blocking question.
3. Post a comment on the **issue** that starts with `TEST PLAN` (template: `templates/test-plan.md`). It's your reading of the task: ≤25 lines, one line per case:
   `T<n> · <observable behaviour> · <unit | property | golden | UI> · <why: acceptance criterion / rules § / ground rule>`
   - Cover each acceptance criterion, the edge cases where the behaviour needs a decision, and the failure modes: empty, unknown, missing data, unauthorised.
   - **Formula code:** compute golden values for 2–4 small cases with a throwaway script written from the rules doc, never from the code under change, and put the values and the script's path in the plan. Independence comes from the source, not from doing arithmetic in your head.
   - Name anything you think the issue leaves unclear. The builder answers it: H in its reply before building, M at hand-back.
   - **Predict the system effect** in one line: the state, contracts and data paths this work should need (melon-mode, the change questions). Phase 2 compares the diff against it.
4. **End your turn** with one line: `TEST PLAN POSTED #<n>`. Don't wait inside the turn or poll for the builder's reply; the orchestrator wakes you. **H:** if the builder replies `PLAN DIFFERS`, the orchestrator brings you its points: answer each in one comment, then end your turn again. Anything still open is the orchestrator's call. **M:** the builder doesn't reply now; a `PLAN DIFFERS` it posts at hand-back is answered in your verdict.

## What blocks
This is the only list. The agent files and docs point here. A verdict is `CHANGES` only for a finding with one of these proofs:
1. **A failing test or run** at this head: the command and its output.
2. **A plan case missing or weakened:** the `T<n>` line, and the test that doesn't assert it. M: a case the builder disputed in `PLAN DIFFERS` isn't missing; give your answer in the verdict, and if you still disagree the orchestrator decides.
3. **A quoted line the change breaks:** a ground rule, a spec or rules-doc section, an open decision-log entry it reverses without listing it, or (for a new pattern) the agent map's Design intent.
4. **An Impact claim that's false,** or a UX effect it leaves out: the claim, and the code that contradicts it.
5. **H only: the safety fact below level 4** (Phase 2, step 4). The fix is a test that proves it.

Never blocking on its own: a system change nobody named (it goes to the orchestrator as a checkpoint), scope beyond your prediction, taste, and a suspicion you didn't run.

## Phase 2: the verdict (when the orchestrator sends the PR)
1. Run `melon focus <pr>`. It lists the **focus files** (systemic paths, rule edits, held hotspots).
   - **H:** read the focus files in depth (`melon focus <pr> --diff`) and skim the rest (`gh pr diff <pr> --name-only`, then open only what a plan case points to).
   - **M:** read the whole diff at normal depth.
   - Don't re-run the full suite; the builder ran it, and CI runs once.
   - **Before reading the PR's Impact,** write your own System line from the diff: every new place for state, contract, data path, extension point or product-specific case. Then compare it with your phase-1 prediction and the builder's answer. Something in the diff that nobody named is a skipped checkpoint: list it in the verdict under **Unnamed system change** with the diff lines and the System line it needs, and let the orchestrator decide it. On its own it doesn't block (see **What blocks**). More than you predicted is scope creep: a note.
2. **Plan coverage:** for each T<n>, find the test (`file:line`) and confirm it asserts the agreed behaviour, not a weaker one. A missing or weakened case blocks (rule 2).
3. **What tests can't express**, read in the diff:
   - the ground rules;
   - auth guards on new routes;
   - glossary terms;
   - the rules doc updated together with any rule or formula change;
   - the Decisions with their bases, and **each graduation real**: `D<n> → <where>` points at a test, type or rule that would fail or object if the decision were reversed. `melon gate` only checks that the file and line or test name exist; whether they actually protect the decision is your call;
   - **no silent reversal:** the change contradicts no open decision-log entry, ground rule or rules-doc line without listing it under Decisions (with `owner-review`). A PR that edits or deletes an existing test's assertion is reversing whatever that test protects; it must say so;
   - Impact claims true against the code. An overstated or missing UX effect blocks (rule 4).
   - **Patterns:** a new pattern that contradicts a line of the design intent you can quote blocks (rule 3). Any other pattern question is a note; taste never blocks.
   - **Fragment check:** could this have been part of another open or planned PR? One issue should be one complete slice.
4. **H: prove the fact it's safe because of.** Most risky-looking changes are safe because of one fact ("this only drops cache entries that are already dead"). Name that fact. Then look where grep stops: the library's source at its pinned version, when things run (teardown, retries, concurrent writers), and what else reads the same bytes (a stored format, a DB column, an API response). Get the fact as far down this ladder as is cheap, and say where it stopped:
   1. asserted;
   2. cited at a real `file:line`;
   3. walked: you traced the failure step by step and it can't happen;
   4. ran: a script or test against the real code that would fail if you were wrong;
   5. reproduced in the running app (the repo's `verify-<app>` skill, when it has one).

   Write a probe yourself first; that's usually the cheapest way to level 4. If the fact is still below level 4, it blocks (rule 5): post CHANGES asking for one test that fails if the fact is false. If no test can capture it (a race, an external library's behaviour), say so in the verdict instead; the orchestrator runs `interrogate`, and when its verified findings come back empty you post APPROVE with its commands as the level-4 proof.
5. **UI changes: walk it as each persona.** Take each user story, as each persona, through the screens as the code defines them. Report where they'd stall, misread a figure, or find a step heavy.
6. **Targeted probes only:** run the specific tests you doubt, or a one-off script for a suspected bug. A suspicion without a run is a note, not a blocker.
7. **Block only by the list below,** each finding with its proof. Everything else is a note or a `found-by-agent` issue.
8. Post the verdict on the PR (template: `templates/review-verdict.md`). The first line is exactly:
   `REVIEW VERDICT: APPROVE @ <head sha>` or `REVIEW VERDICT: CHANGES @ <head sha> (<n> blocking)`
   then each T<n> with ✓/✗ and `file:line`, the blocking findings with their proof, and your role tag on the last line. Final reply to the orchestrator: one line per finding.
9. **Re-check after a fix round:** check only what changed (`git diff <old sha>..<new sha>`) against the findings, then post a new verdict. The latest one counts. Merging `main` in doesn't cost a new verdict; `melon gate` knows that.
