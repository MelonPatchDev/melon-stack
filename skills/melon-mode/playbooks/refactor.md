# Refactor

**Pin the behaviour first, change the structure, prove nothing observable moved.**

1. **Pin.** Before moving code, make sure tests cover what callers observe at the boundary you're changing. Add characterization tests where they're missing, and run them green on `main`.
2. **Converge on the target shape.** Migrate every caller and delete the old path in the same PR: no compatibility shims, no "old and new side by side".
3. **Subtract first.** Remove dead code, one-caller wrappers and redundant validators before adding structure.
4. **Prove zero behaviour change:** the pinned tests pass unchanged. If a pinned test has to change, it's no longer a refactor: say so on the PR and ask the orchestrator to re-tier.
5. **Codemods for sweeps.** When the change touches many files the same way, write the script (in your scratch folder) and run it, rather than editing by hand. Mention it on the PR so a reviewer can re-run it.
