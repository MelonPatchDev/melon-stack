# melon-stack design

melon-stack runs software projects with autonomous Claude Code agents **when agent time is the scarce resource**: a hobby budget, usage limits, one person's subscription. Agent-engineering practice usually assumes you can spend agent time freely. We can't, so every rule here is judged by **useful work per token**.

This doc is the reasoning. The mechanics live in one place each, and agents read only those: roles, tiers and principles in [`melon-mode`](../skills/melon-mode/SKILL.md), each role's steps in its [playbook](../skills/melon-mode/playbooks/), the markers and config in [config.md](config.md).

## The cost model

An agent's cost is roughly **context size × number of calls**. Every call re-reads the whole history, so something read at the start of a session is paid for again on every later call. A 40k-token doc read at the start of a 300-call session costs about 12M input tokens.

The project this grew out of measured its first fully autonomous day (20 merged PRs, with a builder, a fresh reviewer and an orchestrator on every PR):
- about **80M input tokens per merged PR**, mostly cache re-reads of each agent's own history;
- **a ~200-line fix cost about as much as a feature**, because the fixed costs (reading the docs, onboarding, the gate) don't depend on the size of the change;
- fresh reviewers found real defects in most PRs (numeric bugs, an open redirect, order-dependent results), so review is worth keeping where the risk is.

So the big levers are **turns and history**, not instruction length. melon-stack's own instructions are about 4–6k tokens per role; cached across a 300-call session that is well under 1% of a PR's cost. Every rule here does at least one of three things:
1. **Shrink what an agent carries:** a brief instead of the whole doc set, test failures instead of raw logs, an Explore subagent for wide questions.
2. **Cut turns:** scripts instead of agents reasoning about process; no confirmation round trips where nothing is decided.
3. **Move judgment into tests:** a check that runs for free beats a reviewer re-deriving it.

## How opinionated to be

Current models are good at the craft: designing modules, writing specs, finding edge cases. Instructions that teach craft anchor agents to a checklist instead of the problem in front of them, and go stale as models improve; their token cost is the smaller harm. Instructions that are missing leave parallel agents unable to coordinate. So melon-stack is **opinionated about what an agent can't know, and silent about what it already does well.** An instruction earns its place only if deleting it would change what the agent does, for the better. In practice it:
1. **coordinates agents:** markers, formats, hand-offs, stop points, stated exactly and **in one place**, because two copies of a contract drift and an agent follows whichever it read;
2. **encodes a real failure** from this process (preferably as a check, not prose);
3. **states a preference that differs from the model's default:** every principle names the default it corrects.

And it must reach **the reader who can act on it**: a builder gets what to do and at most a clause of why; the mechanics behind it stay here. Rules about one product (how its numbers render, how it fetches) belong in that repo's `CLAUDE.md`, never in a playbook every repo's agents read; [examples/ground-rules.md](../examples/ground-rules.md) shows the kind.

Whether a cut was right is measured, not assumed: `melon escapes` per tier, and review findings per PR, before and after. Guidance comes back where escapes rise. `melon-correct` applies the same test to every new rule, which is also why melon-stack ships no generic spec-writing, domain-modeling or module-design skills.

## The pipeline

```
idea ──melon-concept──▶ spec in a work item + sliced issues (briefs, tiers, dependencies, direction)
     ──orchestrator──▶ builder (+ reviewer for M/H) per issue, up to 3 in parallel
     ──test plan────▶ reviewer posts TEST PLAN blind; H: builder agrees before code
     ──build────────▶ design settled, milestones, diff self-review, melon check
     ──gate─────────▶ melon gate (mechanics) + verdict (M/H) + CI once (M/H)
     ──merge────────▶ melon merge: squash, daily log with the measured ledger
```

## Design comes first, and is the cheapest place to spend
Most expensive rework comes from a design question nobody settled before a builder started. `melon-concept` settles it first: with the user (a designer session grilling one question at a time, facts from the code, decisions from the user), or autonomously (the orchestrator answers from the code and the reasoning order, and labels consequential answers `owner-review` so they can be overruled without blocking). The designer can run beside the orchestrator, so it designs against the work in flight, not just `main`. `melon ledger --since` reports design sessions apart, so "cheapest place to spend" is a number, not a claim.

## Tiers: the process scales with the risk

**Tiers set how much process a change gets, not which model runs it.** S has no reviewer, M gets one review pass, and H adds a design check, an in-depth read of the focus files and golden tests ([definitions](../skills/melon-mode/SKILL.md#1-know-your-role-and-the-tier)).

- The orchestrator's judgment is the main signal; the config sets only a floor, and `melon gate` only ever raises a tier from it. Lowering one is a recorded orchestrator decision.
- **H must stay narrow.** On the original project's last 25 merged PRs, a broad H list (whole packages, any touch of the rules doc) put 21 at H, which would have cost more than having no tiers. A systemic-only list put 12 there, every one of them formula, auth, migration or rate-limit code. For a numbers-heavy app that's honest, which is why review depth inside H is per file. Check a new repo's floor against its own history the same way.

## The change questions
Every role asks the same questions of a change (Idea, System, Patterns, Long term; bugs, tests and types read as statements about contracts). They're asked **where each role decides**, not filled in afterwards, because an answer written after the code tends to justify it: the builder at its checkpoints, the reviewer by writing its own System line before reading the PR's, the orchestrator in briefs and by comparing open PRs' System lines, which catches collisions that hotspots can't see.

## Builder and reviewer: criteria before code
The reviewer writes its TEST PLAN **from the issue and the code, before any diff exists.** That's the independence that matters: the agent that judges a change never wrote it, and committed to its criteria first.

- **H** adds an agreement round (`PLAN AGREED` before feature code), because a misread formula or stored format is expensive to unwind.
- **M skips the round trip.** The builder starts from the acceptance criteria at once, and at hand-back gives each plan case a test or disputes it (`PLAN DIFFERS`), which the verdict answers. The plan still costs the reviewer little (its phase-1 reading is reused for the verdict); what M gives up is tests written first *from the plan*. Formula code, where that matters most, is H. Milestone audits are the backstop, and `melon escapes` per tier says whether it holds.
- **A blocking finding needs proof** from one list in the [review playbook](../skills/melon-mode/playbooks/review.md#what-blocks). Without it, reviewers block on taste and every PR pays a fix round.
- **At most one fix round for M, two for H;** after that the orchestrator decides and labels it `owner-review`. Most M PRs needed one round anyway.
- **Nobody waits inside a turn.** A background agent can't see a new comment until it's woken, and polling `gh` costs a call each time. Each agent ends its turn naming what it waits for, and the orchestrator relays by resuming it.

Verification is tests, not screenshots or video: cheaper to produce and free to re-run. Golden tests (hand-computed examples as fixtures) are how H numeric review becomes a test instead of a reading exercise.

## Records: the code is the documentation
The codebase changes constantly, so docs that record *how it got here* go stale as soon as they're written, and every agent that reads them pays for history it doesn't need. So:

- **Reference docs, in the repo, describe what's true now:** `CLAUDE.md`, `docs/agent-map.md` (with the personas), the glossary, and a rules doc where rules aren't obvious from code. A PR that changes behaviour updates them.
- **Records, in the tracker, look forward:** work items, the decision log, the owner list, direction, the daily log ([who edits which](../skills/melon-mode/playbooks/orchestrate.md#solo-use-records-and-skills)).

**Decisions graduate.** While work is in flight, its decisions live in the decision log so the roles agree. When it merges, each moves into the codebase (a test that fails if it's reversed, a type, a lint or gate rule; else a ground rule or reference-doc line; else nowhere, if the code makes it obvious), and its entry leaves the log. The reasoning stays on the issue or PR, one `git blame` away. The bookkeeping is scripted (`melon gate` checks each graduation names something real, `melon merge` removes the entries, `melon decision add` numbers safely), because it's exactly what slips late in a long session. Whether a graduation really protects its decision is the reviewer's call.

**The tracker is a seam with one adapter.** The roles are fixed and their locations are config; another tracker `kind` fails with a clear message. The first repo that needs one is when we'd extract an interface: one adapter is a hypothetical seam, two make a real one.

## Orchestration a stranger can pick up
The direction record holds the "why" (milestone, persona, bets, why this order, what would change the plan), `melon status` builds the live view from the tracker, and each orchestrator session ends with a short hand-off. A new orchestrator must first answer, from the records alone, *what starts next, why, and what would change the plan*; if it can't, fixing the direction record comes first. At about 200k tokens the orchestrator hands off, because a fresh session is cheaper than carrying the history. Builders can't see their own context size, so `melon context` reads it from their transcript and tells them to hand back at the next milestone.

## Measuring it
`melon ledger <pr>` reads Claude Code's session transcripts, counts each API call once, attributes it to the PR's issues (subagents named `builder #<n>` / `reviewer #<n>`, whole; any other session only for the calls it made on the PR's branch, so a long session that visited it isn't charged in full), and reports raw counts plus an input-equivalent total (cache reads 0.1×, cache writes 1.25× or 2×). `melon merge` writes it into the daily log; `--since` adds design and orchestrator overhead. Transcripts exist only where a session ran, so run it there.

**Cost is half the measurement.** S skips review and M gets a single pass, so a falling ledger could just mean defects are getting through. A bug traced to a merged PR carries `Caused by: #<pr>`, and `melon escapes` reports per tier how many merged PRs later needed a fix. A tier whose escape rate climbs gets a higher floor or more review. Together, the two numbers say whether the savings are real.

## Parallelism, small bugs, audits
- **Up to 3 builders** on parallel work is the main payoff of agents. Hotspots (shared files where parallel edits cause rework) and one migration in flight keep them from colliding.
- **Small bugs batch:** one builder fixes several S items in an area in one session, paying the onboarding cost once.
- **Audits** are a script that flags suspect files plus one model pass over only what's flagged, one or two per milestone. A diff review can't see a ground-rule break that spans PRs; an audit can.
- **Lessons become checks,** at the highest level that works: architecture, then types, lint or a gate rule, then a test, docs last. The check is named after the rule, so the rule's words find it, and the prose it replaces is deleted.

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
