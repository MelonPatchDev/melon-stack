# Build (shared steps for every builder)

**You own one issue from brief to merge-ready, inside its owned paths.** Use this with the task playbook (bug-fix, feature, refactor, systemic, maintenance-batch or perf); a docs or copy change needs none. The steps fix what other agents depend on; how you engineer is yours.

1. **Understand, cheaply.** Read `CLAUDE.md`, `docs/agent-map.md`, the issue with its brief and comments, then the code you own. Send wide questions to an Explore subagent. If the brief is wrong or impossible (a missing dependency, a held hotspot, a conflict with a ground rule), **stop before writing code** and tell the orchestrator in ≤5 lines.
2. **Branch and open the PR early.**
   - Branch `<issue>-<slug>` from the latest `main`.
   - **M/H:** open a **draft** PR at the first push. **S:** open it **ready**; CI only runs on M/H.
   - Fill the PR template.
3. **Settle the design before code,** asking the change questions (melon-mode §3) as you choose, not after. Use the glossary's terms, and treat any new or changed term as a checkpoint (step 5). Record each decision in the PR's Decisions as you make it: one line with its basis from the reasoning order (melon-mode §3), and the rejected alternative when it's hard to reverse. One that later work depends on also goes in the decision log: `melon decision add --for <issue>`.
4. **H: agree the tests before writing code. M: don't wait for the plan;** build from the acceptance criteria, and cover the reviewer's plan at hand-back (step 8).
   - **H: don't wait for the plan inside your turn,** and never poll `gh` for it. If the orchestrator's prompt doesn't already point you to a posted `TEST PLAN`, end your turn here with one line: `READY FOR PLAN #<n>`. The orchestrator wakes you when it's posted.
   - Read the plan, then reply on the issue: `PLAN AGREED`, or start with `PLAN DIFFERS` and list only the points where you read the issue differently, each with its reason.
   - Agreed: carry on. Differs: end your turn with `WAITING ON PLAN ANSWER #<n>`. One exchange; anything still open is the orchestrator's call, and it wakes you with the result.
5. **Checkpoint on what you can't settle alone.** End your turn with that list (≤10 lines) when either:
   - a decision is hard to reverse and the brief didn't settle it: a schema or stored format, a shared contract, a new or changed glossary term, or reversing a recorded decision;
   - the change would add something to the system the brief didn't name: a new place for state, a new contract, a new data path, an extension point, a product-specific special case, or a pattern the design intent doesn't have;
   - you need to change anything outside your owned paths.

   Problems you find elsewhere become issues labelled `found-by-agent tier:s area:<x>`, one paragraph each; don't fix them. If `git log`/`git blame` shows a merged PR introduced the problem, add a line `Caused by: #<pr>`.
6. **Build milestone by milestone.**
   - Tests first: the agreed plan's (H), the acceptance criteria's (M), or the one that proves the fix (S). Docs, copy and config-value changes need no new test: say so in one line under Acceptance criteria.
   - **Between milestones, run only the tests you're working on.** The full suite runs once, at hand-back.
   - **Evidence is tests, not screenshots or videos.**
   - **At each milestone commit, run `melon context <issue>`.** If it exits 1 (over ~150k), hand back now, whatever the brief's size: push, update State and `Data:`, and end your turn with ≤5 lines. **Medium or large briefs hand back after each milestone anyway.** The orchestrator resumes you or hands the next milestone to a fresh builder.
   - **Your own jobs** (a benchmark, a long test run) run in the foreground when they fit in ~10 minutes. A longer one runs in the background: end your turn once with `RUNNING <job> #<n>`, and say nothing else until it finishes.
7. **Read your own diff against the issue** before any full check: every acceptance criterion, the stop point, the Decisions, no debug code, no `TODO` without an issue number.
   - **Graduate each decision** this work implements (the brief's "Decisions this settles", and any decision-log entry you acted on) into the codebase: a test that fails if it's reversed, a type, a lint or gate rule, a ground rule, or a line in a reference doc. Add `D<n> → <where>` to the PR's Decisions, naming a test as `path › "test name"` when there is one (it survives later edits; `path:line` also works). `melon gate` fails if an open entry for your issue has no line, or if the file, line or test name doesn't exist.
   - Don't write decision logs, ADRs, specs or summaries into the repo.
8. **Hand back.**
   - **M: cover the test plan.** Read the `TEST PLAN` on the issue and give each `T<n>` a test. Where you read the issue differently, post one comment on the issue starting `PLAN DIFFERS`, a line per case with its reason, instead of a test; the reviewer and the orchestrator take it from there. No plan posted yet: end your turn with `WAITING ON PLAN #<n>`.
   - Merge the latest `main` in (never rebase a pushed branch, never force-push).
   - Run `melon check --full`; for S, `melon check --full --record <pr>` on the committed head, which runs and records in one pass. Don't pipe it: its last line is the result. `INCOMPLETE` means a check couldn't run here; that's not a pass, and the record says so (merge runs CI for it). If it still fails after one fix, stop and say what fails and why in State.
   - Fill in Impact (the change questions, a line each: Idea and System for S, none for a docs-only S change, all of them for M/H) and Acceptance criteria, each with how it was checked. They record decisions already made at your checkpoints; nothing in them should be news. Set State to "ready for gate".
   - Run `melon gate <pr>`. The only failures left should be the reviewer's verdict or CI.
   - Final message: ≤10 lines, with the commands you ran, their results, checkpoint items and anything unconfirmed. Don't merge or mark the PR ready.
9. **Fix rounds** (M: one, H: up to two). Fix what was proven, each fix with a test that fails without it, and answer the rest on the PR. Re-run only the checks the change touches, but run `--full` if merging `main` brought conflicts in shared code. Update State.

**A fix to shared tooling that's also landing from another PR:** copy it byte for byte, or wait for it.
