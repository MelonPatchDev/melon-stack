---
name: melon-correct
description: Turn recurring agent mistakes into structure - a type, lint, gate rule or test - instead of more prose, then delete the prose it replaces. Use after a retro, when the same review finding appears twice, or when the owner says "agents keep doing X".
---

# melon-correct

**Every rule that's enforced only by prose costs tokens on every agent read and still drifts.** Move rules into structure, then delete the prose. Shrinking `CLAUDE.md` and the playbooks is part of the payoff.

1. **Mine the mistakes.** Gather the findings from the last ~10 merged PRs, or from what the user names:
   - `gh pr list --state merged --limit 10 --json number`, then the `REVIEW VERDICT: CHANGES` comments and `melon gate` failures on each;
   - the orchestrator's checkpoint decisions;
   - audit findings.

   Send this sweep to one Explore subagent and keep only its summary.
2. **Group them into mistake classes**, one line each: what agents do wrong, how often, and an example `PR#/file:line`.
3. **Does it deserve a rule at all?** Ask four questions of each class, and of any rule you'd write:
   - Would a capable model do the right thing anyway, unprompted? Then it's noise, or a one-off: **no rule**.
   - Does it coordinate agents (a marker, a format, a hand-off, a stop point)? **Keep it, stated exactly.**
   - Does it encode a real failure from this repo or process? **Keep it, preferably as a check.**
   - Is it the owner's preference, and does it differ from the model's default? **Keep it, briefly, with the reason.**

   Prose that explains how to engineer (craft a model already has) costs every reader tokens, anchors agents to a checklist, and goes stale as models improve. Delete it where you find it.
4. **Pick the highest level that works** for each class that deserves a rule:
   1. **Architecture:** make the wrong thing impossible (a single entry point, a branded type, a module boundary).
   2. **Types, lint or a gate rule:** an ESLint `no-restricted-syntax` / custom rule, a `melon gate` check (a melon-stack issue or PR), or a CI step.
   3. **A test** that fails when the rule breaks (for example, a test that scans the UI for colour literals outside the token file).
   4. **Docs.** Only when none of the above can express it.
5. **Do it or file it.** Small changes (a lint rule, a test) go in one S-tier PR. Anything larger becomes an issue with a brief. Either way, the change must be shown failing on a deliberate violation once.
6. **Let the check document itself.** Name the test, lint rule or gate check after the rule it enforces ("never maps an option line as stock"), so `rg` finds the enforcement from the rule's words. The checks are the record; don't keep a separate table of them. Remove the rule from the agent map's "rules agents break most often" list.
7. **Delete the prose** that the new check makes redundant (in `CLAUDE.md`, process docs or playbooks). Rules a check already enforces shouldn't be repeated in text agents read on every task.
8. **Reply** (≤10 lines): the classes found, the level chosen for each, PRs and issues, and the prose deleted.
