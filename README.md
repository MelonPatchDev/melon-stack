# melon-stack

**Autonomous Claude Code development for people who can't afford to waste tokens.**

Agent teams are powerful, but every agent, every review round and every re-read of a long session costs tokens, and on a hobby budget or a usage-limited subscription those run out. Tools like [pstack](https://github.com/cursor/plugins/tree/main/pstack) show how rigorous agent engineering can be when agent time is cheap. melon-stack asks a different question: **what's the most useful work an agent team can do per token?**

The answer it settles on:
- **Spend judgment early.** Design questions get settled with you, or by an orchestrator that writes down and flags its decisions, before any builder starts. That's the cheapest place to spend.
- **Scale process to risk.** A docs fix doesn't get the same review as a migration. Most PRs get a cheaper review; only changes that could break something systemic get the expensive one.
- **Turn judgment into tests.** The reviewer writes the test plan *before* the code exists, and the builder writes those tests first. Review then checks a plan instead of re-deriving the code.
- **Script the mechanics.** Labels, hotspots, migration slots, CI and the daily log are handled by a small CLI, not by agents reasoning about process.
- **Measure what it costs, and what it lets through.** A ledger reads Claude Code's own session transcripts, so you know what each PR really cost, not what agents estimate. An escape count tracks how often each tier's PRs later needed a fix, so you can tell whether cheaper review is really safe.
- **The code is the documentation.** Plans, specs and decisions live in your tracker and look forward only. When work merges, each decision graduates into a test, type or rule, and leaves the log. The repo holds only docs that describe what's true now.

It's a Claude Code plugin: skills, playbooks, two agent definitions, templates, and `melon`, a zero-dependency Node CLI.

## Install

```bash
/plugin marketplace add MelonPatchDev/melon-stack
/plugin install melon-stack@melon-stack
```

Claude Code prefixes plugin skills, so `melon-mode` is `/melon-stack:melon-mode`.

## Get started

1. **Adopt it in a repo:** run `/melon-stack:melon-setup` in the repo. It vendors the CLI into `tools/melon/`, writes `melon.config.json`, sets up the records (direction, decision log, owner list) and labels, and writes one short doc agents rely on: `docs/agent-map.md`.
2. **Design something:** `/melon-stack:melon-concept let's design <idea>`. You get grilled one question at a time, then you get a spec and a set of issues, each with a brief, a tier and its dependencies.
3. **Run it:** `/melon-stack:melon-mode orchestrate`. The orchestrator launches up to three builders (each M/H builder paired with a reviewer), gates each PR and merges it.

Requirements: Node 22+, `git`, and the GitHub CLI (`gh`) signed in.

## How work flows

```
idea ──melon-concept──▶ spec + sliced issues (briefs, tiers, dependencies)
     ──orchestrator──▶ builder (+ reviewer for M/H) per issue, up to 3 in parallel
     ──test plan────▶ reviewer posts TEST PLAN before code; builder agrees; tests first
     ──build────────▶ self-grill, milestones, diff self-review, melon check
     ──gate─────────▶ melon gate + verdict (M/H) + CI once (M/H)
     ──merge────────▶ melon merge: squash, daily log with the measured ledger
```

### Tiers
| Tier | When | What it gets |
|---|---|---|
| `tier:s` | small: no risky path, no shared hotspot, ≤400 changed lines of code | a scripted gate and recorded local checks. **No reviewer agent, no PR CI**; CI runs on `main` after a batch. |
| `tier:m` | the default | a test plan agreed with a reviewer on a cheaper model, then CI once |
| `tier:h` | **only** where a break would be systemic: formula code, the stored format, auth | the strongest model, which checks the design first and reads only the risky files in depth; golden tests |

The orchestrator sets the tier. The CLI only ever raises it, from the paths and size of the change.

## Skills

<details>
<summary>All skills</summary>

| Skill | Use it when |
|---|---|
| [`melon-mode`](skills/melon-mode/SKILL.md) | the entry point for orchestrating, building, reviewing, picking up or pausing work. Holds the reasoning order and principles. |
| [`melon-concept`](skills/melon-concept/SKILL.md) | an idea needs to become a spec and buildable issues, with you in the loop or autonomously |
| [`grilling`](skills/grilling/SKILL.md) | you want a plan stress-tested, one question at a time |
| [`melon-audit`](skills/melon-audit/SKILL.md) | a whole-repo audit, where a script picks the files and one model pass judges them |
| [`melon-correct`](skills/melon-correct/SKILL.md) | agents keep making the same mistake; turn it into a lint, gate rule or test |
| [`simplify-single`](skills/simplify-single/SKILL.md) | a cleanup pass over a diff with at most one agent |
| [`melon-setup`](skills/melon-setup/SKILL.md) | adopting melon-stack in a repo |

</details>

<details>
<summary>The melon-mode playbooks</summary>

| Playbook | For |
|---|---|
| [orchestrate](skills/melon-mode/playbooks/orchestrate.md) | choosing work, briefs, launching agents, merging, hand-offs |
| [build](skills/melon-mode/playbooks/build.md) | the shared builder steps: self-grill, checkpoints, milestones, hand-back |
| [bug-fix](skills/melon-mode/playbooks/bug-fix.md) | reproduce as a failing test, fix the root cause, fix every occurrence |
| [feature](skills/melon-mode/playbooks/feature.md) | data shape first, one whole user-visible slice |
| [refactor](skills/melon-mode/playbooks/refactor.md) | pin behaviour, change structure, prove nothing moved |
| [systemic](skills/melon-mode/playbooks/systemic.md) | formula code, stored formats and auth (H tier) |
| [maintenance-batch](skills/melon-mode/playbooks/maintenance-batch.md) | several small fixes in one session |
| [perf](skills/melon-mode/playbooks/perf.md) | measure, explain the number, fix, guard |
| [review](skills/melon-mode/playbooks/review.md) | the test plan before code, the verdict after |
| [pickup-and-pause](skills/melon-mode/playbooks/pickup-and-pause.md) | stop cleanly and resume from the PR alone |

</details>

Agents: [`melon-builder`](agents/melon-builder.md) and [`melon-reviewer`](agents/melon-reviewer.md). Templates for briefs, test plans, verdicts, hand-offs, the records and the agent map are in [`templates/`](templates/).

Companions we recommend but don't bundle: Anthropic's [`frontend-design`](https://github.com/anthropics/claude-plugins-official) plugin for UI work, and any data-visualization skill you trust for charts.

## The CLI

`melon` is Node 22 with no dependencies. It shells out to `git` and `gh`, and `melon-setup` vendors it into your repo so every worktree and CI job runs the same version.

| Command | Does |
|---|---|
| `melon check [--full] [--record <pr>]` | runs the checks for the changed paths; prints **only failures**; `--record` posts the pass, pinned to the commit |
| `melon gate <pr> [--fix]` | the mechanical merge conditions: tier, PR sections, TODOs, hotspots, migration slot, clean merge, decisions graduated, test plan and verdict |
| `melon focus <pr> [--diff]` | the files a reviewer must read in depth, and their diff alone |
| `melon merge <pr>` | gate → CI per tier → squash → daily-log line with the measured ledger → graduated decisions leave the log → batch CI on `main` |
| `melon ledger <pr>` | what the PR really cost, by role, from the session transcripts |
| `melon escapes [--since <date>]` | per tier, how many merged PRs later needed a fix (`Caused by: #<pr>`) |
| `melon status` | the live board: in flight, ready (dependencies closed), what each item unlocks, hotspots |
| `melon records [--check]` | where each record lives in this repo (decision log, owner list, direction, …) |
| `melon batch [--create]` | groups small bugs by area into one maintenance issue |
| `melon audit <name>` | flags files for an audit: `state-machines`, `style-drift`, `react-composition`, `privacy`, `docs-drift` |
| `melon labels [--apply]` · `melon init` | create missing labels · vendor the CLI |

Configure it with `melon.config.json` ([reference](docs/config.md), [example](examples/monorepo.config.json)).

## Principles

Twelve one-line principles live in [`melon-mode`](skills/melon-mode/SKILL.md#5-principles), adapted from pstack and Matt Pocock. Each names the model default it corrects: smallest change, fix root causes, prove it with a test, prefer deep modules, no seam without a second adapter, the code is the documentation, and so on.

melon-stack is deliberately **opinionated about what an agent can't know** (how agents coordinate, what's failed before, where your preferences differ from the model's defaults) **and silent about craft a capable model already has.** There are no spec-writing or module-design tutorials here; see [docs/design.md](docs/design.md#how-opinionated-to-be).

## Why it's built this way

[docs/design.md](docs/design.md) has the reasoning: the cost model (context × calls), what the first project measured, why the H tier is narrow, and a table of what we took from pstack and Matt Pocock, what we adapted, and what we skipped as too costly.

## Develop

```bash
npm test
```

This runs unit tests for the rules, audits and ledger, plus integration tests that run every command that writes to GitHub against a real git repo and a fake `gh`.

## Acknowledgements

melon-stack draws inspiration from:

- **[pstack](https://github.com/cursor/plugins/tree/main/pstack)** by [poteto](https://github.com/poteto) (Lauren Tan). The playbook-per-task router, the principles, "block only on a problem you can show", encoding lessons as checks (`/correct`), the benchmark checklist and the pause/pickup flow all come from pstack, adapted for a budget.
- **[Matt Pocock's skills](https://github.com/mattpocock/skills)**. `grilling` is adapted from his work; `melon-concept`'s design stage builds on his grill-with-docs approach; and the deep-module and seam principles come from his `codebase-design`.

Both are MIT-licensed; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

[MIT](LICENSE)
