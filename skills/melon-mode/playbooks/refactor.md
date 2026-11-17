# Refactor

**Pin the behaviour, change the structure, prove nothing observable moved.**

- **Pin first:** tests at the boundary you're changing, green on `main` before you move anything.
- **Converge in one PR:** migrate every caller and delete the old path. No shims, no old-and-new side by side.
- **Zero behaviour change** means the pinned tests pass unchanged. If one has to change, it isn't a refactor: say so on the PR and ask the orchestrator to re-tier.
- **Sweeps:** script the change (in your scratch folder) rather than editing by hand, and mention the script on the PR so a reviewer can re-run it.
