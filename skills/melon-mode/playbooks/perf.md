# Perf

**Measure, find what limits the number, fix that, measure again the same way.**

- **Baseline:** the repo's benchmark, or a small repeatable one on seed data at scale; median and range over at least 5 alternating runs.
- **Don't act on a number you can't explain:** name what limits it, and confirm both sides ran the same build, data and warm-up, with the measured work inside the timed region.
- **An index or schema change** is a stored-format change: migration slot, H tier.
- **Guard it:** turn the budget into a test or bench assertion so it can't regress silently. Run benches alone, not beside the suite.
- **PR:** before and after (median, range, run count, the limiter), and the verdict: faster, slower, no measurable difference, or inconclusive.
