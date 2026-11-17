# melon-stack design

melon-stack runs software projects with autonomous Claude Code agents **when agent time is the scarce resource**: a hobby budget, usage limits, one person's subscription. It borrows heavily from [pstack](https://github.com/cursor/plugins/tree/main/pstack) and [Matt Pocock's skills](https://github.com/mattpocock/skills). But pstack assumes you can spend agent time freely, and we can't, so every rule here is judged by **useful work per token**.

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

## The pipeline

```
idea ──melon-concept──▶ spec + sliced issues (briefs, tiers, dependencies, direction.md)
     ──orchestrator──▶ builder (+ reviewer for M/H) per issue, up to 3 in parallel
     ──test plan────▶ reviewer posts TEST PLAN, builder agrees, tests first
     ──build────────▶ self-grill, milestones, diff self-review, melon check
     ──gate─────────▶ melon gate (mechanics) + verdict (M/H) + CI once (M/H)
     ──merge────────▶ melon merge: squash, daily log with the measured ledger
```

## Design comes first, and is the cheapest place to spend
Most expensive rework comes from a design question that nobody settled before a builder started. `melon-concept` runs before any builder:
- **With the user:** a grilling loop. One question at a time, each with a recommended answer; facts come from the code, decisions come from the user.
- **Autonomously:** the orchestrator self-grills, answers from the code and the reasoning order, and labels consequential answers `owner-review`.

It grounds the design in the code on `main` (never memory), pins the domain language (glossary, edge-case scenarios), writes one spec at the right level of detail (specific for data, state and computation; directional for UI), designs related issues together, and slices the work into complete user-visible issues, each with a brief.

**Reasoning order** (what "correct" means, for every role):
1. ground rules;
2. personas and what each would never want;
3. the issue's stories and acceptance criteria;
4. precedent (the decision log and the code);
5. tie-breakers.

A call resting on none of them is a labelled **taste call**.

## Tiers: the process scales with the risk

Every issue and PR carries exactly one tier label.

| Tier | Label | For | Process |
|---|---|---|---|
| S | `tier:s` | docs, copy, dependency bumps, small fixes, mechanical cleanups: no M or H path, no held hotspot, at most `sMaxChurn` changed lines of code | builder → `melon check --record` → `melon gate` → merge. **No reviewer agent. No PR CI;** CI runs on `main` after a batch of S merges. |
| M | `tier:m` | the default: features, UI slices, refactors, ingestion, contracts, rule docs | the builder and reviewer agree a **test plan** → build → review on a cheaper model → CI once → merge |
| H | `tier:h` | **only where a break would be systemic and hard to undo:** formula code behind the numbers users act on, the stored format, auth | as M, but the strongest-model reviewer checks the design first and reads the **focus files** (`melon focus`) in depth, skimming the rest; golden tests for formulas; `owner-review` for rule changes |

- The orchestrator sets the tier when it writes the issue. That judgment is the main signal; the config sets only a floor.
- **The floor only goes up automatically.** `melon gate` fails a PR labelled below what the change requires (`--fix` raises the label):
  - **H:** a file on the narrow `tiers.h` list, or an edit (a deleted or changed line) to an `hEdits` file;
  - **M:** a file on `tiers.m`, a held hotspot, or more than `tiers.sMaxChurn` changed lines of code (docs, fixtures and lockfiles don't count);
  - **S:** anything else.
- **Check the floor against history.** On the original project's last 25 merged PRs, a broad H list (whole packages, any touch of the rules doc) put 21 at H, which would have cost more than having no tiers. A systemic-only list put 12 there, every one of them formula, auth, migration or rate-limit code. For a numbers-heavy app that's honest, which is why review depth inside H is per file.
- Anyone may raise a tier. Only the orchestrator lowers one, and it records why on the PR.

## Roles

| Role | Owns | Doesn't do |
|---|---|---|
| **Owner** | direction, owner-only actions (money, accounts and keys, legal, commercial use, new user data), reading the daily log | approving individual PRs |
| **Orchestrator** | what starts next, briefs, tiers, hotspot and migration slots, settling disagreements, running `melon merge`, keeping `direction.md` current | quality review: it never re-reviews code |
| **Builder** | one issue (or one batch of S issues) from brief to merge-ready | changing paths it doesn't own; merging |
| **Reviewer** (M, H) | the test plan (and, for H, the design check), then the verdict | writing the feature |

### The builder and reviewer agree what the task means
1. **Test plan.** The reviewer reads the issue and the code it touches **on its own**, and posts a `TEST PLAN` comment on the issue: the cases that must pass, each with its kind of test (unit, property-based, UI assertion, golden). For H it first verifies the brief's claims against the code, citing `file:line`, and computes golden values by hand.
2. **Agreement.** The builder posts `PLAN AGREED`, or lists only where it reads the issue differently. One exchange settles most differences; the orchestrator settles the rest by posting `PLAN AGREED (settled by orchestrator)`.
3. **Build.**
   - The builder self-grills the design and records each decision with its basis.
   - It checkpoints the hard-to-reverse choices the brief didn't settle (schema, shared contracts, glossary terms, reversing a decision).
   - It writes the agreed tests first, builds milestone by milestone, running only the tests it's working on between milestones, and reads its own diff against the issue before the full checks.
4. **Verdict.** `REVIEW VERDICT: APPROVE @ <sha>` or `CHANGES @ <sha>`. The reviewer:
   - checks the tests match the plan;
   - reads the diff for what tests can't express;
   - walks UI changes as each persona.

   **A blocking finding needs proof:** a failing test or run, or a line of a spec or ground rule the change breaks.
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

## Orchestration that a fresh agent can pick up

| Artifact | Holds | Kept current by |
|---|---|---|
| `docs/direction.md` (~1 page) | the current milestone and its persona, the bets, why work is in this order, open questions, **what each upcoming piece will teach us and how it could change the plan** | the orchestrator, whenever priorities move; the owner edits freely |
| GitHub labels | status, tier, area (`status:*`, `tier:*`, `area:*`, `parked`) | every agent; `melon status` builds the live view |
| `docs/decisions.md` | settled decisions, numbered, each with its basis | the PR that makes the decision |

- **Hand-off:** each orchestrator session ends with a ≤15-line comment on the `direction` issue.
- **Cold-start check:** a new orchestrator first answers, from the artifacts alone, *what starts next, why, and what would change the plan*. If it can't, fixing `direction.md` comes first.

## Measuring it
`melon ledger <pr>` reads Claude Code's session transcripts, counts each API call once, attributes them to the PR's issues, and reports raw counts plus an input-equivalent total (cache reads 0.1×, cache writes 1.25× or 2×, at API list prices). Attribution works for subagents described as `builder #<n>` / `reviewer #<n>`, and for sessions on a branch named `<n>-…`. `melon merge` writes the measurement into the daily log.

Transcripts exist only on the machine where a session ran, so run the ledger there. Compare per-PR totals before and after adoption; that decides whether this design works.

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
| `docs-drift` | references to spec sections that don't exist |

## Lessons become checks
When agents repeat a mistake, fix it at the highest level that works, in this order:
1. architecture;
2. types, lint or a `melon gate` rule;
3. a test;
4. docs, last.

`docs/enforcement.md` pairs each rule with what enforces it, and prose a check makes redundant gets deleted.

## What we took, and what we skipped

| Taken | Adapted | Skipped (too costly for us) |
|---|---|---|
| playbooks by task type (pstack) | verification → tests only, no screenshot or video | verifier swarms per PR |
| a done check in every brief (pstack) | different-model review → H only, one pass | arena / competing prototypes by default |
| "block only on a problem you can show" (pstack) | benchmark checklist → the perf playbook | multi-model panels |
| encode lessons as checks (pstack `/correct`) | decision log → PR Decisions + `decisions.md` | an hourly root loop probing agents |
| pause safely / session pickup (pstack) | babysit → `melon status` + `melon gate` (scripts, not an agent) | formal verification |
| grilling, domain modeling, deep modules (Matt Pocock) | design-it-twice → only on request or for H seams | a cloud VM per agent |
| the principles index (pstack) | | |
