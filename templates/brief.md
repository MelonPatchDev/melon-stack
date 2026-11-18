## Brief
<!-- Written once by the orchestrator (or melon-concept), at design time. The builder starts from this instead of reading every doc.
S tier: Goal, Done check and Owned paths are enough; add other fields only when they apply. -->
**Goal:** <!-- one or two sentences: what users get, and for which persona -->
**Asked for:** <!-- who asked, why, and the urgency they stated; input for the orchestrator's order, not an order. Omit for work the orchestrator planned itself -->
**Done check:** <!-- something that can pass or fail: the tests, a command and its expected output, a budget -->
**Tier:** tier:<s|m|h>, because <!-- the path or risk that sets it -->
**Expected size:** <!-- small | medium | large; medium and large builds hand back at each milestone -->
**Depends on:** <!-- #n, #m (closed before this can start), or "none" -->
**Owned paths:** <!-- globs; anything else is a checkpoint -->
**Stop point:** <!-- what not to build here, and the interface or fixture to build against instead -->
**Hotspots it may touch:** <!-- from melon status; "none" if none -->
**System and long term:** <!-- new state, contracts or data paths this adds, who else they affect, and what it will make hard to change later; "none" if none -->
**UX effect:** <!-- what each persona sees differently -->

### Design and rule excerpts
<!-- Quote only what applies, with file:line for every claim about the code: the design decisions from the parent work item, open decision-log entries (D<n>), rules-doc sections, glossary terms, ground rules. -->

### Decisions this settles
<!-- Decision-log entries this work implements, and where each graduates to (a test, type, lint, ground rule or reference doc). -->

### Acceptance criteria
- [ ] <!-- testable; becomes the reviewer's TEST PLAN for M/H -->
