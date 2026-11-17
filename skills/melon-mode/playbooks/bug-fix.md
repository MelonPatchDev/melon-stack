# Bug fix

**Reproduce it as a failing test, fix the root cause, fix every occurrence.**

1. **Restate the defect** in one line: what happens, what should happen, and where it was seen (issue, data row, log line).
2. **Reproduce it as a test** at the lowest level that shows it: unit if possible, Playwright only if the bug is in the flow. The test must fail on `main` for the reason in the issue. If you can't reproduce it, say so with what you tried, and stop.
3. **Root cause.** Trace back to the first place the system went wrong. A guard downstream is a fix only if the state it catches is legitimate.
   - **Name the PR that introduced it,** if one did (`git log -S`, `git blame`), with a `Caused by: #<pr>` line in the issue body. `melon merge` tags the fix as an escape in the daily log, and `melon escapes` counts escapes per tier, which is how the team learns whether cheaper review is letting defects through. If the bug predates melon-stack or has no single cause, leave the line out.
4. **Every occurrence.** Search for the same pattern (`rg`, or an Explore subagent for wide sweeps) and fix or list each one. A fix covers the cause, not just the reported instance.
5. **Fix**, run the new test plus the affected suites (`melon check`), and confirm the test fails without the fix (revert locally once, or say why you can't).
6. **Data fixes:** if stored rows are wrong, describe the clean-up step (re-run, re-map, re-score) and make it idempotent. Real data stays outside the worktree; record where it is on the `Data:` line.
7. **PR:** the Impact section says what users saw before and see now; the test name says what it guards.
