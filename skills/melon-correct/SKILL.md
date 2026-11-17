---
name: melon-correct
description: Turn recurring agent mistakes into structure - a type, lint, gate rule or test - instead of more prose, and keep docs/enforcement.md pairing each rule with what enforces it. Use after a retro, when the same review finding appears twice, or when the owner says "agents keep doing X".
---

# melon-correct

**Every rule that's enforced only by prose costs tokens on every agent read and still drifts.** Move rules into structure, then delete the prose. Shrinking `CLAUDE.md` and the playbooks is part of the payoff.

1. **Mine the mistakes.** Gather the findings from the last ~10 merged PRs, or from what the user names:
   - `gh pr list --state merged --limit 10 --json number`, then the `REVIEW VERDICT: CHANGES` comments and `melon gate` failures on each;
   - the orchestrator's checkpoint decisions;
   - audit findings.

   Send this sweep to one Explore subagent and keep only its summary.
2. **Group them into mistake classes**, one line each: what agents do wrong, how often, and an example `PR#/file:line`.
3. **Pick the highest level that works** for each class:
   1. **Architecture:** make the wrong thing impossible (a single entry point, a branded type, a module boundary).
   2. **Types, lint or a gate rule:** an ESLint `no-restricted-syntax` / custom rule, a `melon gate` check (a melon-stack issue or PR), or a CI step.
   3. **A test** that fails when the rule breaks (for example, a test that scans the UI for colour literals outside the token file).
   4. **Docs.** Only when none of the above can express it.
4. **Do it or file it.** Small changes (a lint rule, a test) go in one S-tier PR. Anything larger becomes an issue with a brief. Either way, the change must be shown failing on a deliberate violation once.
5. **Keep the table.** Update `docs/enforcement.md` in the target repo (template: `${CLAUDE_PLUGIN_ROOT}/templates/enforcement.md`): rule → enforced by → since (PR).
6. **Delete the prose** that the new check makes redundant (in `CLAUDE.md`, process docs or playbooks). Rules a check already enforces shouldn't be repeated in text agents read on every task.
7. **Reply** (≤10 lines): the classes found, the level chosen for each, PRs and issues, and the prose deleted.
