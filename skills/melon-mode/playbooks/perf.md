# Perf

**Measure, find what limits the number, fix that, measure again the same way.**

1. **Baseline.** Use the repo's benchmark (or write a small, repeatable one in the test suite with seed data at scale). Record the median and range over at least 5 alternating runs.
2. **Explain the number** before acting on it:
   - What limits it (a query plan, an index, CPU, I/O, network), and why isn't it double or half?
   - Did both sides run the same build, data and warm-up?
   - Did the measured work actually happen inside the timed region, and return correct output?
   - Does it matter on the path a user waits on?
3. **Fix the measured cause.** For queries, read `EXPLAIN (ANALYZE, BUFFERS)` rather than guessing. An index is a stored-format change (migration slot, H tier).
4. **Guard it.** Turn the budget into a test or bench assertion (for example, p95 under 200 ms on seed data at production scale) so it can't regress silently. Run benches alone, not beside the suite.
5. **PR:** before and after (median, range, run count, the limiter) in the Acceptance criteria, and the verdict: faster, slower, no measurable difference, or inconclusive.
