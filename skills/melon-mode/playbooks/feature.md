# Feature

**Name the data shape first, build to the agreed tests, and deliver one whole user-visible slice.**

1. **Data shape and contract.** Before any logic, write the types and the API contract (zod in the contracts package, when the repo has one) the feature needs, and the states the UI can be in (loading, empty, error, partial, full) as one union rather than a set of booleans. If the contract is a hotspot someone else holds, stop at your checkpoint.
2. **Tests from the plan.** Turn each agreed case into a test. UI behaviour gets Playwright assertions on seed data (text, roles, counts, URLs), not pixels.
3. **Build the slice end to end:** DB query → API → contract → UI, with the tests passing at each step. One issue = one complete PR; never split it by layer.
4. **UI work:** follow the repo's design doc and tokens (every colour and size from the token file). If you have them, load a data-visualization skill before any chart or colour choice, and the `frontend-design` plugin before a new screen. Numbers render through the repo's formatting components.
5. **Words:** use glossary terms. A new term goes into the glossary in this PR and is listed under Decisions.
6. **Impact section:** what each persona (the repo's features doc) sees differently, including anything slower or more cluttered. Compare it with the issue's UX effect line.
