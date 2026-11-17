# Bug fix

**A failing test first, then the root cause, then every occurrence.**

- **Reproduce it as a test** at the lowest level that shows it, failing on `main` for the reason in the issue. If you can't reproduce it, say what you tried and stop.
- **Name the PR that introduced it,** if one did (`git log -S`, `git blame`), with a `Caused by: #<pr>` line in the issue body. `melon merge` tags the fix as an escape in the daily log, and `melon escapes` counts escapes per tier, which is how the team learns whether cheaper review is letting defects through. Leave the line out if the bug predates melon-stack or has no single cause.
- **Every occurrence** of the same cause is fixed, or listed on the PR.
- **Confirm the test fails without the fix** (revert locally once), or say why you can't.
- **Stored data that's wrong:** describe an idempotent clean-up step. Real data stays outside the worktree; record where it is on the `Data:` line.
