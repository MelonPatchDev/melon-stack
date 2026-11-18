# Refactor

**Pin the behaviour, change the structure, prove nothing observable moved.**

- **Pin first:** tests at the boundary you're changing, green on `main` before you move anything.
- **If a pinned test has to change, it isn't a refactor:** say so on the PR and ask the orchestrator to re-tier.
- **One PR converges** (principle 7). For a sweep, the script that does it (principle 13) goes in the PR description so the reviewer can re-run it.
