---
name: melon-mode
description: Entry point for agent work in a melon-stack repo. Use at the start of any orchestrator, builder or reviewer task; it sets the tier, picks the playbook, and holds the reasoning order and principles. Trigger on "melon-mode", "orchestrate", "build issue #n", "review PR #n", "pick up PR #n", "pause".
---

# melon-mode

The repo's `CLAUDE.md` and ground rules win over anything here. The scripted half is the `melon` CLI (`melon <cmd> --help`; most repos expose it as `pnpm melon` or `npm run melon --`). Budget is the constraint: do the useful work with the fewest tokens.

## 1. Know your role and the tier
- **Role:**
  - **orchestrator:** chooses what starts, writes briefs, assigns tiers and slots, runs `melon merge`; never reviews code;
  - **builder:** one issue, or one maintenance batch;
  - **reviewer:** test plan, then verdict; never writes the feature.

  Design work before any issue exists uses the `melon-concept` skill.
- **Tier** is the issue's `tier:s|m|h` label, set by the orchestrator. The change can only raise it (`melon gate --fix`), and only the orchestrator lowers it.
  - **S:** small changes (no M/H path, no held hotspot, ≤ `sMaxChurn` lines of code). No reviewer agent and no PR CI; `melon check --record` is the evidence.
  - **M:** the default. Test plan, a cheaper-model review, CI once.
  - **H:** only where a break would be systemic and hard to undo (formula code, stored format, auth). Strongest-model review of the focus files (`melon focus`), golden tests, `owner-review` for rule changes.

## 2. Pick the playbook
Read only the playbook you need:

| Situation | Playbook |
|---|---|
| Orchestrating: choosing work, launching agents, merging, hand-off | [orchestrate](${CLAUDE_SKILL_DIR}/playbooks/orchestrate.md) |
| Building any issue: the shared steps | [build](${CLAUDE_SKILL_DIR}/playbooks/build.md), plus one of the next four |
| A defect | [bug-fix](${CLAUDE_SKILL_DIR}/playbooks/bug-fix.md) |
| New or changed behaviour | [feature](${CLAUDE_SKILL_DIR}/playbooks/feature.md) |
| Structure only, zero behaviour change | [refactor](${CLAUDE_SKILL_DIR}/playbooks/refactor.md) |
| Formula code, a stored format or auth (H) | [systemic](${CLAUDE_SKILL_DIR}/playbooks/systemic.md) |
| A batch of small fixes | [maintenance-batch](${CLAUDE_SKILL_DIR}/playbooks/maintenance-batch.md) |
| Measured slowness or a time budget | [perf](${CLAUDE_SKILL_DIR}/playbooks/perf.md) |
| Reviewing (test plan or verdict) | [review](${CLAUDE_SKILL_DIR}/playbooks/review.md) |
| Resuming someone's work, or stopping cleanly | [pickup-and-pause](${CLAUDE_SKILL_DIR}/playbooks/pickup-and-pause.md) |

Other skills:
- design: `melon-concept`, `grilling`, `domain-modeling`, `brainstorm`, `codebase-design`;
- quality: `melon-audit`, `melon-correct`, `simplify-single`;
- adoption: `melon-setup`.

**Templates** named in the playbooks (`templates/<name>.md`) are in `${CLAUDE_PLUGIN_ROOT}/templates/`: brief, test-plan, review-verdict, handoff, pr-body, direction, decisions, agent-map, enforcement.

## 3. Reasoning order (what "correct" means)
Every judgment call, by any role, rests on the first of these that settles it:
1. the ground rules (`CLAUDE.md`);
2. the personas and what each would never want (the repo's features doc);
3. the issue's user stories, UX effect and acceptance criteria;
4. precedent: the decision log and the existing code;
5. the repo's tie-breakers.

A call that rests on none of them is a **taste call**: make it, and list it in the PR's Decisions as "taste call".

## 4. Context discipline (the main cost lever)
Everything you read is paid for again on every later call.
- **Read order:** `CLAUDE.md`, then `docs/agent-map.md`, then the issue's **brief**, then the code you own. Open other docs only when a step needs them, and read the section, not the file.
- **Wide questions** ("where is X used", "how does Y work across packages") go to an Explore subagent. Keep its summary, not the file dumps.
- **Never paste raw logs.** `melon check` prints only failures, and full logs are in `.melon/logs/`; `grep` them.
- **Don't re-read** a file you just edited, or a doc you've already summarised.
- **Prefer a script to reasoning** for anything mechanical: `melon gate` exists so you don't think about labels or hotspots.
- **Long jobs** (backfills, data runs) run in the background and write a status file. Check it at milestones; never wait inside a turn.
- **Around 200k tokens of context,** stop at the next clean point (pickup-and-pause). A fresh agent continues from the PR's Plan and State.

## 5. Principles
Apply them by name in reasoning and reviews.
1. **Smallest change that solves it.** Delete before adding; no speculative options.
2. **Data shape first.** Name the types and the contract before the logic; downstream code should become obvious.
3. **Fix root causes.** Trace the symptom to where things first went wrong. A guard is a fix only when the state it handles is legitimate. Fix every occurrence.
4. **Prove it with a test** that fails without the change. A "compiles" or "looks right" claim isn't evidence.
5. **Test behaviour, not implementation:** assert what a user or caller can observe.
6. **Parse at the boundary, trust types inside.** Make illegal states unrepresentable; exhaust unions.
7. **Idempotent operations.** Re-running converges to the same state.
8. **Explain the number.** Before trusting a measurement, name what limits it and rule out measuring the wrong thing.
9. **Encode lessons in structure.** A recurring mistake becomes a type, lint, gate rule or test, not more prose.
10. **Attack the premise.** After two failed fixes that share a premise, test the premise itself.
11. **Migrate callers, then delete the old path.** No compatibility shims within one repo.
12. **Decide reversible calls; ask only for owner-only actions** (money, accounts and keys, legal, commercial use, new user data).
13. **Unknown is a value.** Never invent data; store unknown and flag it.

## 6. Replies
- Final messages: ≤10 lines, evidence (command + result, `file:line`), and what's next or blocked.
- Comments end with your role tag (`[builder #n]`, `[reviewer #n]`, `[orchestrator]`).
- Say each thing once and link instead of repeating.
