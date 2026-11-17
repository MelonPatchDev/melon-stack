# Build (shared steps for every builder)

**You own one issue from brief to merge-ready, inside its owned paths.** Use this with the task playbook (bug-fix, feature, refactor, systemic, maintenance-batch or perf).

1. **Understand, cheaply.**
   - Read `CLAUDE.md`, `docs/agent-map.md`, the issue with its brief and comments, then the code you own.
   - Send wide questions to an Explore subagent.
   - There's no summary round trip. But if the brief is wrong or impossible (a missing dependency, a held hotspot, a conflict with a ground rule), **stop before writing code** and tell the orchestrator in ≤5 lines.
2. **Branch and open the PR early.**
   - Branch `<issue>-<slug>` from the latest `main`.
   - **M/H:** open a **draft** PR at the first push.
   - **S:** open it **ready** (not draft). CI only runs on M/H.
   - Fill the PR template: `Closes #n`, Plan (3 lines from the brief), State, Data, Impact, Acceptance criteria, Decisions, Unconfirmed facts.
3. **M/H: agree the tests before writing code.**
   - Wait for the reviewer's `TEST PLAN` on the issue.
   - Reply `PLAN AGREED`, or start with `PLAN DIFFERS` and list only the points where you read the issue differently, each with its reason (brief line, spec section).
   - One exchange; anything still open goes to the orchestrator.
4. **Self-grill the design.** Before coding, walk the design branch by branch and answer every question yourself:
   - look facts up in the code; never guess;
   - challenge each term against the glossary;
   - invent edge cases that force each boundary to be precise.

   Record each decision in the PR's Decisions as you go: one line, with its basis from the reasoning order (melon-mode §3). For a hard-to-reverse one, name the rejected alternative.
5. **Checkpoint on what you can't settle alone.** End your turn with that list (≤10 lines) when either:
   - a decision is hard to reverse and the brief didn't settle it: a schema or stored format, a shared contract, a new or changed glossary term, or reversing a recorded decision;
   - you need to change anything outside your owned paths.

   Otherwise carry on. Problems you find elsewhere become issues labelled `found-by-agent tier:s area:<x>`, one paragraph each. Don't fix them.
6. **Build milestone by milestone.**
   - Write the agreed tests first, or for S the test that proves the fix, and watch them fail for the right reason.
   - One commit per plan step, with docs alongside the code.
   - **Between milestones, run only the tests you're working on** (one test file, plus a typecheck if you're unsure the code compiles). Not the full suite; that runs once, at hand-back.
   - Evidence is unit, property-based and golden tests, plus UI assertions for flows. No screenshots or videos.
   - **Medium or large briefs: hand back after each milestone.** Push, update State and `Data:`, and end your turn with ≤5 lines: the milestone done, what's next. The orchestrator can see your context size and you can't; it resumes you or hands the next milestone to a fresh builder.
7. **Read your own diff against the issue** before any full check: every acceptance criterion, the brief's stop point, the Decisions, and no stray debug code or `TODO` without an issue number. This is the cheapest review there is.
   - **Graduate each decision** this work implements (the brief's "Decisions this settles", and any decision-log entry you acted on). Make sure each now lives in the codebase: a test that fails if it's reversed, a type, a lint or gate rule, a ground rule, or a line in a reference doc. Add `D<n> → <where>` to the PR's Decisions. Don't write decision logs, ADRs or specs into the repo.
8. **Hand back.**
   - Merge the latest `main` in (never rebase a pushed branch, never force-push).
   - Run `melon check --full`. For S, use `melon check --record <pr>` on the committed head instead. Fix what fails and run it once more; if it still fails, stop and say what fails and why in State.
   - Fill in Impact and Acceptance criteria, each with how it was checked. Set State to "ready for gate"; keep `Data:` current.
   - Run `melon gate <pr>`. The only failures left should be the reviewer's verdict or CI.
   - Final message to the orchestrator: ≤10 lines, with the commands you ran, their results, checkpoint items and anything unconfirmed. Don't merge or mark the PR ready.
9. **Fix rounds.** Fix what was proven and answer the rest on the PR (fixed, or not changed and why). Re-run only the checks the change touches, but run `--full` if merging `main` brought conflicts in shared code. Update State.

**A fix to shared tooling that's also landing from another PR:** copy it byte for byte, comments included, or wait for it.
