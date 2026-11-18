---
name: interrogate
description: Adversarial review - 2-3 adversaries try to break a change or design; only run-proven findings survive. Use for "interrogate", "adversarial review", "tear this apart", an H safety fact no test can prove, or a tier whose escape rate climbs.
---

# interrogate

**Adversaries try to break the change. A finding survives only when a run proves it.** Report the findings; don't apply fixes.

It's the most expensive review melon-stack has: each adversary reads the change on its own. Use it when:
- the owner asks for it;
- an H-tier verdict reports the change's safety fact as **unproven** and a break would be systemic;
- `melon escapes` shows a tier or area letting defects through, and you're spot-checking it.

Never for S. Not a default step for M or H.

## Frame
- **Scope:** what the user names. Otherwise the PR (`gh pr diff <n>`), otherwise the branch's diff from its merge base with `main`, working tree included.
- **Intent:** restate it in ≤3 lines from the issue's brief, its acceptance criteria and the PR's Impact. If you can't, ask (with a person present) or stop (unattended). An adversary can't break an intent nobody stated.

## Fan out
- **Two adversaries by default, three at most.** Different readers catch different bugs, so vary them: a different `model` each (`opus`, `sonnet`, `fable` where available), or, on one model, a different angle each:
  1. data: edge values, unknown and missing data, formulas, units;
  2. time: ordering, retries, concurrency, idempotence, partial failure;
  3. boundaries: auth, input parsing, each persona misusing the feature.
- Spawn them in one message, in the background, each with `isolation: "worktree"` so their repros can't collide. For uncommitted scope, save the diff to a patch file and tell each to apply it.
- Name them `interrogate #<issue>` so `melon ledger` counts them.
- Give each the scope, the intent, its angle, and this brief:

  > Break this change. Prove each finding by running it against the real code: a failing test, a repro script, or command output that shows the wrong behaviour. For a design or plan, run a prototype or probe the current tree. Keep repros in your worktree. Report each finding with a title, the exact command, the output it printed, and the output the intent requires. Leave out anything you didn't run, including style, naming, structure, and risks that need some future change to matter. No findings is a valid result.

## Verify
Rerun each finding's command yourself. With many findings, one verifier subagent on a cheap model reruns them all. Keep a finding when the output shows the failure **and** the failure breaks the intent. Drop the rest. Merge findings that share a root cause. Keep every verified finding, whichever adversary found it.

## Output
- **Intent:** the restatement.
- **Findings:** for each, the command, its output, how it breaks the intent, and which adversary found it. Or "no verified findings".
- **Dropped:** per adversary, how many and why.

On a PR, a verified finding at the head is proof under the review playbook, so it blocks. Hand it to the reviewer for the verdict, or to the orchestrator.
