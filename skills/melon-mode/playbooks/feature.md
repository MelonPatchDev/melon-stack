# Feature

**One whole user-visible slice, built to the agreed tests.**

- **One issue = one complete PR:** data, API, contract and UI together. Never split by layer.
- **Tests from the plan:** each agreed case becomes a test. UI behaviour gets assertions on seed data (text, roles, counts, URLs), not pixels.
- **A shared contract** someone else holds as a hotspot is a checkpoint; stop there.
- **UI:** the repo's design doc and tokens decide colours and sizes; numbers render through its formatting components. If you have them, use the `frontend-design` plugin for a new screen, and a data-visualization skill for charts.
- **Words:** glossary terms only. A new term goes into the glossary in this PR and is listed under Decisions.
- **Impact:** what each persona (the repo's features doc) sees differently, including anything slower or more cluttered, compared with the issue's UX effect line.
