# Pick up and pause

## Pause (session cap, a usage limit, or the owner says stop)
1. Finish the current step, or back it out to the last green state. Never leave a half-applied edit.
2. Commit work in progress (`wip: <step>`), push it, and run nothing else.
3. Update the PR's **State** block so a stranger can continue:
   - done: the plan steps completed, with commit SHAs;
   - next: the exact next step **and the command to run first**;
   - tried and didn't hold: each approach abandoned or reverted, why, and the evidence, so the next agent doesn't retry it;
   - blocked on: anything waiting, with links;
   - `Data:` where any real data, DB or volume lives.
4. Final message: ≤5 lines, pointing at the PR.

## Pick up (a fresh agent continuing someone's work)
Skip full onboarding. Read, in order:
1. `CLAUDE.md` and `docs/agent-map.md`;
2. the issue's brief and the TEST PLAN thread;
3. the PR: Plan, State, Data, Decisions, and every review comment since the last verdict;
4. `git log --oneline origin/main..HEAD` and the diff of the last commit;
5. **the previous agent's worktree, if it still exists:** `git -C <worktree> status --short` and `git -C <worktree> diff --stat`. A stop at a usage limit leaves no `wip:` commit and a stale State; uncommitted work there is the real resume point. Commit it as `wip:` from that worktree and continue there, rather than redoing it.

Then run `melon check` to see where things stand, and continue from State's "next". If State and the code disagree, trust the code, fix State first, and say so in your first message.

Orchestrator pick-up is the cold start in the orchestrate playbook (step 0).
