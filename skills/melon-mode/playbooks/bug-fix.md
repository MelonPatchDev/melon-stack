# Bug fix

**A failing test first, then the root cause, then every occurrence.**

- **Reproduce it as a test** at the lowest level that shows it, failing on `main` for the reason in the issue. If you can't reproduce it, say what you tried and stop.
- **Name the PR that introduced it,** if one did (`git log -S`, `git blame`), with a `Caused by: #<pr>` line in the issue body. It's how review misses get counted. Leave the line out if the bug predates melon-stack or has no single cause.
- **Is it a gap in the design?** A bug that a missing contract, type or test allowed is a system change. Say so in the PR's System line, and if the same gap has caused bugs before, raise it for `melon-correct`.
- **Every occurrence** of the same cause is fixed, or listed on the PR.
- **Confirm the test fails without the fix** (revert locally once), or say why you can't.
- **Stored data that's wrong:** describe an idempotent clean-up step. Real data stays outside the worktree; record where it is on the `Data:` line.
