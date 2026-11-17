# Orchestrate

**You direct the work; you don't judge its quality.** You choose what starts, write briefs, assign tiers and slots, settle builder–reviewer disagreements, run `melon merge`, and keep the records true: **direction**, **decision log**, **owner list** (`melon records` says where each lives). Quality comes from the tests the builder and reviewer agreed on, and from the gate.

## 0. Cold start (every new orchestrator session)
1. Run `melon records` to find the records. Read the **direction** record and its latest hand-off, then run `melon status`.
2. Answer, in ≤6 lines, from those artifacts alone:
   - **What starts next?**
   - **Why that, and for which persona?**
   - **What result would change the plan?**
3. If you can't answer from the artifacts, **fixing the direction record is your first task.** Orchestration must stay resumable by a stranger.
4. After any context compaction, re-read the direction record, `melon status` and your last hand-off before acting.

## 1. Choose the next work
- Take the order in the direction record. `melon status` lists what's **ready** (every `Depends on:` closed) and what each item unlocks. Fill up to **3 builders** on parallel work. It's a rolling priority order, not lockstep batches: whenever a builder frees up, start the highest-priority ready issue.
- `melon status` shows the hotspots and migration each open PR holds. Don't start an issue that would modify a held hotspot, and allow **one migration in flight**.
- `parked` PRs are invisible to scheduling. Leave them alone.
- Small finds: run `melon batch`. An area marked ● is ready, and `--create` turns it into one maintenance issue for one builder session.

## 2. Make sure the issue has a brief
- An outline issue (no brief yet) goes through the `melon-concept` skill in autonomous mode first. **Expand it from the code on `main`, never from memory,** and design related issues together.
- A complete brief fills `templates/brief.md`, including design excerpts with **`file:line` references**. Have an Explore subagent pull the excerpts; don't read whole docs yourself.
- Label `tier:*`, `area:*` and `status:ready`.

## 3. Launch
**Name agents for the ledger.** The Agent description must be `builder #<issue>` or `reviewer #<issue>` (also `design #<n>`, `audit #<n>`). `melon ledger` attributes token use by that name, and by branch `<issue>-…` for sessions.

**Every prompt is self-contained.** The agent starts cold. A **builder** prompt carries:
- the setup: worktree path (from the latest `main`), ports, database name, scratch folder;
- the issue number and tier, and "follow melon-mode → build + <playbook>";
- **what's in flight beside it, and the paths those PRs own**;
- the migration slot, if assigned;
- **anything decided since the issue was written**.

A **reviewer (M/H)** is launched at the same time:
- read-only, no worktree, reads through `gh` and `git`, own scratch folder;
- "Review #<n> (tier:<t>). Phase 1: post the TEST PLAN on the issue now. Phase 2 starts when I send the PR number."
- **Model by tier:** M gets a cheaper model. H gets the strongest, but the reviewer reads only the focus files in depth (`melon focus`).

Then set the issue to `status:building`.

**Agents never wait inside a turn; you relay.** A background agent can't see a new GitHub comment until someone wakes it, and polling `gh` burns a call each time. So:
1. **M/H:** launch both at once. The builder does only the no-code steps (understand, branch, draft PR, self-grill) and ends its turn with `READY FOR PLAN`. The reviewer posts `TEST PLAN` and ends its turn.
2. When both are back, resume the builder (SendMessage): "TEST PLAN is on #<n>; reply PLAN AGREED or PLAN DIFFERS, then build if agreed."
3. **PLAN DIFFERS:** resume the reviewer with the builder's points for its one answer. Then resume the builder with that answer. If they still disagree, decide from the brief and the spec yourself, and post a comment starting `PLAN AGREED (settled by orchestrator)` so the gate sees an agreed plan.
4. **Verdict:** resume the same reviewer with the PR number. Its phase-1 reading is still in its context, which beats a fresh reviewer re-reading the issue.

An agent that ends its turn waiting on something names exactly what it's waiting for in its last line, so you know whom to wake.

**A resume prompt** gives:
- what landed since;
- your decision on each point, with the principle behind it (not a patch list);
- which checks to run, what to reply on the PR, and the reply's line limit.

## 4. While they work
- **Checkpoints:** decide them yourself, using the reasoning order (melon-mode §3). Record the decision on the PR (Decisions). Label consequential, controversial or hard-to-reverse choices `owner-review`.
- **Owner-only actions** (money, accounts and keys, legal notices, commercial use, new third parties or new user data): label `needs-owner` and add the exact request under **Needs you** in the owner list (`templates/owner-list.md`). Build the recommended option behind config so review can still go ahead.
- **The owner list is yours alone:** edit it in place; there are no copies elsewhere. Consequential decisions go under **Review later**. Record each answer where it applies (the work item, the decision log) before moving it to Done.
- **New decisions** that outlive the current conversation (a checkpoint ruling, a design call that later issues depend on) get a line in the **decision log**, with where each will graduate and **the work item it's for** (`#n` in the last column). `melon gate` holds any PR that closes that work item until it names where the decision now lives. **When an outside source blocks the work, ask on the first confirmed failure;** don't retry for days first.
- **Milestone hand-backs:** builders on medium or large briefs hand back after each milestone. Read the token count each agent reports when it stops. Under ~200k, resume the same agent with "go". Over, start a fresh one of the same role with the pickup playbook. Builders can't see their own context size; you can.

## 5. Merge
At hand-back (State "ready for gate"):
- **M/H:** send the reviewer the PR number for its verdict. At most 2 fix rounds; after that, decide, record the basis and label `owner-review`.
- Run `melon gate <pr>`, then `melon merge <pr>`.
  - With no `--ledger`, merge measures the cost from the session transcripts.
  - Exit 3 means CI was started (merge marks a draft ready, or dispatches a run when a ready head has none) or is still running. Subscribe to the PR, end your turn, and run it again when CI finishes.
  - **One M/H PR in CI at a time.**
  - On a red CI run, the PR goes back to draft and to the builder.
- **Merge in dependency order.** A hotspot file changed on `main` under an approved PR means the reviewer re-checks the affected part after `main` is merged in.
- After merging:
  - **graduations are scripted:** `melon gate` already checked that every open decision-log entry for this work has a `D<n> → <where>` line, and that the named file and line exist. `melon merge` removes those entries from the log. You don't re-check them; the reviewer checked that each graduation really protects the decision;
  - read the PR's `Data:` line before removing its worktree or volumes;
  - set statuses;
  - if the merge changed priorities or taught something, update the direction record ("What would change the plan"), and remove finished milestones from it.
- **If something bad lands on `main`:** revert the merge at once (`git revert` in a PR, merged through `melon merge` as S), reopen the work item, and open a bug issue with `Caused by: #<the bad PR>` so it counts as an escape. Fix forward in a new PR.

## 6. Audits and lessons
- **Every 5 merges** (and before any deploy), run the `melon-audit` skill on the 1–2 audits that ran longest ago, plus its `spot-check` of one recently merged PR. Diff reviews miss ground-rule breaks that span PRs, and audits catch them. Record which ran in your hand-off.
- **When the same review finding shows up twice,** run `melon-correct` on it.
- **With each audit round, run `melon escapes`.** It shows, per tier, how many recently merged PRs later needed a fix (`Caused by: #<pr>` on the fixing issue). Cost alone can't tell you whether cheaper review is working; this can. If a tier's escape rate climbs (for example M escapes clustering in one area), raise that area's tier floor in `melon.config.json` or give that tier a stronger reviewer, and say why in the direction record.

## 7. Your own context
You're the longest-lived session, so you're the costliest per call.
- Never read agents' transcripts, full diffs or test logs. Use `melon status`, `melon gate` and the agents' ≤10-line reports.
- **At ~200k tokens of context, finish the current merge, post the hand-off and stop.** The next session cold-starts from step 0. Starting fresh is cheaper than carrying the history.

## 8. Hand-off (end of every orchestrator session)
Post `templates/handoff.md` (≤15 lines) as a comment on the direction record: in flight, next, why, open decisions, what would change the plan, last audit and escape rates.

## Traps seen in practice
- Infrastructure checked with one test instead of the full suite.
- A scratch file shared between agents, then overwritten.
- A later PR reversing a recorded decision without listing it.
- A builder polling `gh issue view` in a loop for the test plan, spending a call each time.
- Outlines expanded from memory instead of the code on `main`.
- Related issues designed separately, then redesigned later.
- A hotspot changed on `main` under an approved PR, and never re-checked.
- A ground-rule break spanning several PRs, missed by every diff review (this is what audits are for).
- An outside source blocking scripts, retried on separate days before anyone asked the owner.
- A multi-hour data run inside an agent's turn, ending half done.
