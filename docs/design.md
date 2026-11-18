# melon-stack design

melon-stack runs software projects with autonomous Claude Code agents **when agent time is the scarce resource**: a hobby budget, usage limits, one person's subscription. Agent-engineering practice usually assumes you can spend agent time freely. We can't, so every rule here is judged by **useful work per token**.

## The cost model

An agent's cost is roughly **context size × number of calls**. Every call re-reads the whole history, so something read at the start of a session is paid for again on every later call. A 40k-token doc read at the start of a 300-call session costs about 12M input tokens.

The project this grew out of measured its first fully autonomous day (20 merged PRs, with a builder, a fresh reviewer and an orchestrator on every PR):
- about **80M input tokens per merged PR**, mostly cache re-reads of each agent's own history;
- **a ~200-line fix cost about as much as a feature**, because the fixed costs (reading the docs, onboarding, the gate) don't depend on the size of the change;
- fresh reviewers found real defects in most PRs (numeric bugs, an open redirect, order-dependent results), so review is worth keeping where the risk is.

Every rule here does at least one of three things:
1. **Shrink what an agent carries:** a brief instead of the whole doc set, test failures instead of raw logs, an Explore subagent for wide questions.
2. **Cut turns:** scripts instead of agents reasoning about process; no confirmation round trips where nothing is decided.
3. **Move judgment into tests:** a check that runs for free beats a reviewer re-deriving it.

## How opinionated to be

Current models are good at the craft: designing modules, writing specs, finding edge cases. Instructions that teach craft cost every reader tokens on every call, anchor agents to a checklist instead of the problem in front of them, and go stale as models improve. Instructions that are missing leave parallel agents unable to coordinate. So melon-stack is **opinionated about what an agent can't know, and silent about what it already does well.** An instruction earns its place only if it:
1. **coordinates agents:** markers, formats, hand-offs, stop points (stated exactly);
2. **encodes a real failure** from this process (preferably as a check, not prose);
3. **states a preference that differs from the model's default:** every principle names the default it corrects (over-building, symptom guards, compatibility shims, repo docs about history, waiting inside a turn, asking).

Anything a capable model would do unprompted is deleted. Whether a cut was right is measured, not assumed: `melon escapes` per tier, and review findings per PR, before and after. Guidance comes back where escapes rise. `melon-correct` applies the same test to every new rule, which is also why melon-stack ships no generic spec-writing, domain-modeling or module-design skills: their few real opinions live in `melon-concept` and the principles.

## The pipeline

```
idea ──melon-concept──▶ spec in a work item + sliced issues (briefs, tiers, dependencies, direction)
     ──orchestrator──▶ builder (+ reviewer for M/H) per issue, up to 3 in parallel
     ──test plan────▶ reviewer posts TEST PLAN, builder agrees, tests first
     ──build────────▶ design settled, milestones, diff self-review, melon check
     ──gate─────────▶ melon gate (mechanics) + verdict (M/H) + CI once (M/H)
     ──merge────────▶ melon merge: squash, daily log with the measured ledger
```

## Design comes first, and is the cheapest place to spend
Most expensive rework comes from a design question that nobody settled before a builder started. `melon-concept` runs before any builder:
- **With the user:** a grilling loop, run by a **designer** session. One question at a time, each with a recommended answer; facts come from the code, decisions come from the user. The designer can run while the orchestrator works, so it first reads what's in flight (`melon status`, the open decision log) and designs against that, not just `main`.
- **Autonomously:** the orchestrator asks itself the design questions, answers from the code and the reasoning order, and labels consequential answers `owner-review`.

It grounds the design in the code on `main` (never memory), pins the domain language (glossary, edge-case scenarios), writes one spec at the right level of detail (specific for data, state and computation; directional for UI), designs related issues together, and slices the work into complete user-visible issues, each with a brief.

**Reasoning order** (what "correct" means, for every role):
1. ground rules;
2. personas and what each would never want;
3. the issue's stories and acceptance criteria;
4. precedent (the code, its tests, and the open decision-log entries);
5. tie-breakers.

A call resting on none of them is a labelled **taste call**.

## Tiers: the process scales with the risk

**Tiers set how much process a change gets, not which model runs it.** S has no reviewer, M gets one review pass, and H adds a design check, an in-depth read of the focus files and golden tests. Model choice is left to whoever runs the session.

Every issue and PR carries exactly one tier label.

| Tier | Label | For | Process |
|---|---|---|---|
| S | `tier:s` | docs, copy, dependency bumps, small fixes, mechanical cleanups: no M or H path, no held hotspot, at most `sMaxChurn` changed lines of code | builder → `melon check --record` → `melon gate` → merge. **No reviewer agent. No PR CI;** CI runs on `main` after a batch of S merges. |
| M | `tier:m` | the default: features, UI slices, refactors, ingestion, contracts, rule docs | the builder and reviewer agree a **test plan** → build → one review pass → CI once → merge |
| H | `tier:h` | **only where a break would be systemic and hard to undo:** formula code behind the numbers users act on, the stored format, auth | as M, but the reviewer checks the design against the code first and reads the **focus files** (`melon focus`) in depth, skimming the rest; golden tests for formulas; `owner-review` for rule changes |

- The orchestrator sets the tier when it writes the issue. That judgment is the main signal; the config sets only a floor.
- **The floor only goes up automatically.** `melon gate` fails a PR labelled below what the change requires (`--fix` raises the label):
  - **H:** a file on the narrow `tiers.h` list, or an edit (a deleted or changed line) to an `hEdits` file;
  - **M:** a file on `tiers.m`, a held hotspot, or more than `tiers.sMaxChurn` changed lines of code (docs, fixtures and lockfiles don't count);
  - **S:** anything else.
- **Check the floor against history.** On the original project's last 25 merged PRs, a broad H list (whole packages, any touch of the rules doc) put 21 at H, which would have cost more than having no tiers. A systemic-only list put 12 there, every one of them formula, auth, migration or rate-limit code. For a numbers-heavy app that's honest, which is why review depth inside H is per file.
- Anyone may raise a tier. Only the orchestrator lowers one, and it records why on the PR.

## The change questions
Every role evaluates a change with the same five questions: **Idea** (the main idea), **System** (what changes beyond this module, and who else it affects: new state, contracts, data paths, extension points, product-specific cases), **Patterns** (does it follow the design intent, or add a pattern worth having more of), **Long term** (what it unlocks, constrains, and makes hard to change), and **bugs, tests and types** read as statements about the system's contracts.

They're asked **where each role decides**, not filled in afterwards, because an answer written after the code tends to justify it:
- **The builder** asks them while choosing. A System item or a new pattern is a checkpoint before code, and the PR's Impact section records the answers.
- **The reviewer** predicts the system effect in its test plan, then writes its own System line from the diff *before* reading the PR's. A system change nobody named goes to the orchestrator as a skipped checkpoint; a pattern blocks only against a quoted line of the design intent. What may block is one list, in the review playbook.
- **The orchestrator** puts System and Long term into each brief at design time, compares open PRs' System lines (`melon status` prints them) to catch collisions hotspots can't see, and adds patterns accepted at merge to the agent map's **Design intent**, so the intent stays current with the code.

`melon gate` requires the answers by tier: Idea and System for S, all four for M and H.

## Roles

| Role | Owns | Doesn't do |
|---|---|---|
| **Owner** | direction, owner-only actions (money, accounts and keys, legal, commercial use, new user data), reading the daily log | approving individual PRs |
| **Designer** | a request turned into work items with the user: what it means for the app, its scope, stories, acceptance criteria and a proposed tier (`melon-concept`) | starting agents; changing work already being built |
| **Orchestrator** | what starts next, briefs, tiers, hotspot and migration slots, settling disagreements, running `melon merge`, keeping the records current | quality review: it never re-reviews code |
| **Builder** | one issue (or one batch of S issues) from brief to merge-ready | changing paths it doesn't own; merging |
| **Reviewer** (M, H) | the test plan (and, for H, the design check), then the verdict | writing the feature |

### The builder and reviewer agree what the task means
1. **Test plan.** The reviewer reads the issue and the code it touches **on its own**, and posts a `TEST PLAN` comment on the issue: the cases that must pass, each with its kind of test (unit, property-based, UI assertion, golden). For H it first verifies the brief's claims against the code, citing `file:line`, and computes golden values by hand.
2. **Agreement.** The builder posts `PLAN AGREED`, or lists only where it reads the issue differently. One exchange settles most differences; the orchestrator settles the rest by posting `PLAN AGREED (settled by orchestrator)`.

   **Nobody waits inside a turn.** A background agent can't see a new comment until it's woken, and polling `gh` costs a call each time. So each agent ends its turn naming what it waits for (`READY FOR PLAN #n`, `TEST PLAN POSTED #n`), and the orchestrator relays by resuming it. Builder and reviewer still start together: the builder does its no-code steps (understand, branch, draft PR, settle the design) while the reviewer writes the plan.
3. **Build.**
   - The builder settles the design before code, asking the change questions, and records each decision with its basis.
   - It checkpoints the hard-to-reverse choices the brief didn't settle (schema, shared contracts, glossary terms, reversing a decision).
   - It writes the agreed tests first, builds milestone by milestone, running only the tests it's working on between milestones, and reads its own diff against the issue before the full checks.
4. **Verdict.** `REVIEW VERDICT: APPROVE @ <sha>` or `CHANGES @ <sha>`. The reviewer:
   - checks the tests match the plan;
   - reads the diff for what tests can't express;
   - walks UI changes as each persona.

   **A blocking finding needs proof,** from one list in the review playbook ("What blocks"): a failing run, a plan case missing, a quoted rule broken, a false Impact claim, or an unproven H safety fact.
5. **At most two fix rounds.** After that the orchestrator decides and labels the decision `owner-review`.

The agent that judges a change never wrote it, and it committed to its criteria before seeing the code.

## Verification is programmatic
Tests, not screenshots or video. They're cheaper to produce and free to re-run.
- **Unit tests** for logic.
- **Property-based tests** for formulas and idempotent writes.
- **Golden tests:** hand-computed spec examples as fixtures. This is how H-tier numeric review becomes a test instead of a reading exercise.
- **UI assertions** (Playwright or similar, on seed data) for flows. No pixel evidence unless an issue asks for it.

## Checks and CI
- `melon check` runs the configured checks for the paths that changed. It writes full logs to `.melon/logs/` and prints **only the failures**. `--full` runs everything, and `--record <pr>` posts the result as a `MELON CHECK` comment pinned to the commit.
- **S tier:** no PR CI. `melon gate` needs a passing `MELON CHECK` that covers the head. After `ci.batchAfterSMerges` S merges, `melon merge` dispatches one CI run on `main`.
- **M and H tiers:** CI runs once, on a head that contains `main`. `melon merge` marks a draft ready, or dispatches a run when a ready head has none.
- An approval or check record survives merging `main` in. Only the PR's own new commits invalidate it.

## Context discipline
Agents should understand the repo before changing it, but reading costs on every later call, so they read in this order:
1. `CLAUDE.md` and `docs/agent-map.md` (**≤3k tokens**: what lives where, the rules most often broken, which doc answers which question);
2. the issue's **brief**, with spec excerpts and `file:line` references;
3. the code it owns, then other docs only when a step needs them;
4. wide questions go to an Explore subagent, which returns a summary.

**Session cap:** at about 200k tokens of context, an agent's next task goes to a fresh agent, which resumes from the PR's Plan and State. The orchestrator caps itself the same way and hands off.

## Records: the code is the documentation
The codebase changes constantly, so docs that record *how it got here* go stale as soon as they're written, and every agent that reads them pays for history it doesn't need. melon-stack keeps two kinds of written material apart:

- **Reference docs, in the repo, describing what's true now:** `CLAUDE.md` (ground rules), `docs/agent-map.md`, the glossary, and a rules doc for anything whose rules aren't obvious from code (how numbers are computed, for example). They must match the code, and a PR that changes behaviour updates them in the same PR.
- **Records, in the tracker, looking forward:** what's planned, open and in flight. Skills name records by **role**, and each repo's `melon.config.json` says where each one lives (`melon records` prints the table; GitHub issues by default):

| Record | Holds | Edited by |
|---|---|---|
| **work item** | one issue: brief, tier, `Depends on:`, the design discussion and spec | orchestrator, designer (until `status:building`); a builder adds only a `Caused by:` line to a bug |
| **decision log** | **open** decisions for unfinished work, each with where it will graduate | any role, through `melon decision add` |
| **owner list** | Needs you / Review later / Coming up / Done | orchestrator only |
| **direction** | what's next and why (the body); orchestrator hand-offs (comments) | orchestrator; the owner freely |
| **daily log** | one line per merge, with the measured ledger | `melon merge` |

**Decisions graduate.** While work is in flight, its decisions live in the decision log so the builder, the reviewer and the orchestrator agree. Any role adds one with `melon decision add`, which numbers it and re-reads the log after writing: the log is one issue body, so two hand edits can share a `D<n>` or silently drop each other's row. `melon merge` removes graduated entries the same way, and `melon direction place` does it for the direction record's order, which designers and the orchestrator both write. When the work merges, each decision moves into the codebase:
1. a test that fails if the decision is reversed, a type, or a lint or gate rule (strongest);
2. a ground rule or a line in a reference doc;
3. or nowhere, if the code already makes it obvious.

Then its entry leaves the log. The builder names each graduation in the PR (`D3 → src/foo.test.ts › "rejects negative amounts"`, or `path:line`). **The mechanics are scripted, because they're orchestrator bookkeeping that slips late in a long session:**
- `melon gate` fails a PR that closes a work item while an open decision-log entry for it has no `D<n> →` line, or when a graduation names a file or line that isn't in the PR head.
- `melon merge` removes the graduated entries from the log.

What a script can't judge, whether the test really fails if the decision is reversed, is the reviewer's job. Reversal protection is mostly tests, which no reviewer can forget to check. The reasoning stays on the issue or PR that argued it, one `git blame` away.

No ADRs, decision files, committed specs, roadmaps or enforcement tables in the repo.

**The tracker is a seam.** The roles are fixed; their locations are config. The CLI supports `github-issues`, `github-issue` and `file` today. Any other `kind` (a Jira project, say) is valid config, but it fails with a clear message when a command needs it. The first repo that needs another tracker is when we'd extract a tracker interface. One adapter is a hypothetical seam; two make a real one.

## Orchestration that a fresh agent can pick up
- **The direction record** holds the "why": the current milestone and its persona, the bets, why work is in this order, open questions, and **what each upcoming piece will teach us and how it could change the plan**. Finished milestones leave it.
- **`melon status`** builds the live view from the tracker: what's in flight, what's ready (every dependency closed), what each item unlocks, hotspots and slots. It lists ready work in the order the direction record's order section first mentions it, and ready work the record doesn't mention apart, so a ticket a designer filed mid-session gets placed rather than started by accident or forgotten.
- **Hand-off:** each orchestrator session ends with a ≤15-line comment on the direction record.
- **Cold-start check:** a new orchestrator first answers, from the records alone, *what starts next, why, and what would change the plan*. If it can't, fixing the direction record comes first.

## Measuring it
`melon ledger <pr>` reads Claude Code's session transcripts, counts each API call once, attributes them to the PR's issues, and reports raw counts plus an input-equivalent total (cache reads 0.1×, cache writes 1.25× or 2×, at API list prices). Attribution works for subagents described as `builder #<n>` / `reviewer #<n>`, and for sessions on a branch named `<n>-…`. `melon merge` writes the measurement into the daily log.

`melon ledger --since` adds what no PR carries: design sessions (top-level sessions that ran `melon-concept` or `grilling`) and the orchestrator's own, reported apart, so "design is the cheapest place to spend" is a number, not a claim.

Transcripts exist only on the machine where a session ran, so run the ledger there. Compare per-PR totals before and after adoption; that decides whether this design works.

**Cost is half the measurement.** S skips review and M gets a single pass, so a falling ledger could just mean defects are getting through. A bug traced to a merged PR carries `Caused by: #<pr>`. `melon merge` tags the fix in the daily log ("fixes an escape from #12 (tier:m)"), and `melon escapes` reports, per tier, how many recently merged PRs later needed a fix. A tier whose escape rate climbs gets a higher floor or more review. Together, the two numbers say whether the savings are real.

## Parallelism and hotspots
- Up to 3 builders run on parallel work. That's the main payoff of agents.
- **Hotspots** (shared files where parallel edits cause rework) are listed in `melon.config.json`. Two open PRs never modify the same hotspot. Adding new files, or append-only edits to files listed as `appendOnly`, don't count.
- **One migration in flight.**
- `parked` marks experimental or side PRs. Tooling and the orchestrator skip them.

## Small bugs
Each small find is its own issue labelled `found-by-agent` (or `bug`) + `tier:s` + `area:<x>`. When an area has `batch.minIssues` of them, `melon batch --create` opens one maintenance issue covering them, and one builder fixes them in one session, paying the onboarding cost once.

## Audits
Named audits, each a **script that flags suspect files** plus **one focused model pass over only what's flagged**. One or two run per milestone, in rotation:

| Audit | Flags |
|---|---|
| `state-machines` | boolean-flag clusters; status strings compared in many places |
| `style-drift` | colour and size literals outside token files; orphaned tokens |
| `react-composition` | oversized components, derive-only effects, wide props |
| `privacy` | outbound hosts, undocumented env vars (plus a route-guard check) |
| `docs-drift` | references to rules-doc sections that don't exist |
| `spot-check` | no script: one recently merged PR's riskiest file, read as it is on `main` |

## Lessons become checks
When agents repeat a mistake, fix it at the highest level that works, in this order:
1. architecture;
2. types, lint or a `melon gate` rule;
3. a test;
4. docs, last.

Each check is named after the rule it enforces, so the rule's words find it. The checks are the record; prose a check makes redundant gets deleted.

## What we adapted, and what we skipped

| Adapted for a budget | Skipped (too costly for us) |
|---|---|
| verification → tests only, no screenshot or video | verifier swarms per PR |
| review panels → one reviewer, for M and H only; rigor scales by tier, not by model | arena / competing prototypes by default |
| adversarial review → `interrogate`, on request only: ≤3 adversaries, run-proven findings only | multi-model panels by default |
| blast radius → H reviewers prove the one fact a change is safe because of | an hourly root loop probing agents |
| app verification → `melon-verify`: text evidence, parameterised for parallel builders, journeys promoted to tests | formal verification |
| benchmark checklist → the perf playbook | a cloud VM per agent |
| decision log → open decisions only, graduating into tests | generic design-craft skills (spec writing, domain modeling, module design) |
| babysitting PRs → `melon status` + `melon gate` (scripts, not an agent) | |
| deep modules and seams → three principles; the spec's level of detail → one rule in `melon-concept` | |

Sources are credited in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
