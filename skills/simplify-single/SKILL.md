---
name: simplify-single
description: Single-agent /simplify. Review changed code (a diff, branch or PR) for reuse, simplification, efficiency and altitude, then apply the fixes, using AT MOST ONE subagent (on Opus). Use instead of the built-in /simplify, which fans out to 4 parallel agents, when token budget matters.
disable-model-invocation: true
---

# simplify-single

This improves the quality of the changed code; it does not hunt for bugs (that's `/code-review`). It covers the
same four angles as the built-in `/simplify`, but one reviewer works through them **in sequence**. Never start
more than one agent for this skill.

## Phase 0: gather the diff

- With no target: `git diff @{upstream}...HEAD` (fall back to `git diff main...HEAD` or `HEAD~1`). If there are
  uncommitted changes or the range is empty, include `git diff HEAD` too.
- With a target (PR number, branch or path): review that. For a PR, `gh pr diff <N>`. For a STACKED PR, diff
  against its parent branch (`git diff <parent>...<branch>`), not main, so the parent's changes aren't reviewed
  twice.

## Phase 1: review (ONE agent, or none)

- **Small diff (under ~400 changed lines):** do the review yourself and start no agent.
- **Larger diff:** start exactly **one** review agent with `model: "opus"`. Pass it the diff, or tell it how to
  get it, and all four angles below. It covers them one after another and returns findings with `file`, `line`, a
  one-line `summary`, and the concrete cost.
- Never run parallel review agents, and never one agent per angle.

### The four angles (review in this order)

1. **Reuse:** new code that re-implements something the codebase already has. Grep shared/utility modules and
   files next to the change, and name the existing helper to call instead.
2. **Simplification:** complexity the diff adds: redundant or derivable state, copy-paste with slight variation,
   deep nesting, dead code left behind. Name the simpler form that does the same job.
3. **Efficiency:** wasted work the diff introduces: repeated computation or I/O, independent operations run one
   after another, blocking work added to startup or hot paths, and long-lived closures that keep large scopes
   alive. Name the cheaper alternative.
4. **Altitude:** each change should fix the root cause at the right depth, not patch a symptom. Special cases
   layered on shared infrastructure are a sign the fix isn't deep enough. Name the more general change to the
   underlying mechanism.

## Phase 2: apply the fixes

- Merge findings that point at the same line or mechanism, then fix each remaining one directly. The single agent
  may apply the fixes itself if it was briefed to.
- Skip a finding whose fix would change intended behaviour, needs changes well outside the reviewed diff, or is a
  false positive. Note the skip rather than arguing with it.
- Never weaken a line marked `INVARIANT:`.
- Re-run the repo's local bar after applying fixes.
- Finish with a short summary: what was fixed, and what was skipped and why. Or confirm the code was already
  clean.
