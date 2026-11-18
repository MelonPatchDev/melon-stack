# melon.config.json

Lives at the target repo's root. Every field is optional except where a command needs it. Defaults are in `cli/lib/config.mjs`; a full example is `examples/monorepo.config.json`. Globs support `**`, `*`, `?` and `{a,b}`.

| Field | Default | Used by | Meaning |
|---|---|---|---|
| `mainBranch` | `main` | all | the trunk |
| `timeZone` | `UTC` | merge | the daily-log day (IANA zone) |
| `signature` | `[orchestrator]` | merge, batch | last line of comments the CLI posts for the orchestrator |
| `checks[]` | `[]` | check | `{ name, run, paths?, docsOnly? }`, in run order. Without `paths`, it always runs; with `paths`, only when a changed file matches. `docsOnly: true` means it also runs when every change is docs-only. |
| `docsOnly` | `["docs/**", "**/*.md"]` | check | when every changed path matches, only `docsOnly` checks run |
| `tiers.h` | `[]` | gate, focus | systemic paths: touching one requires H |
| `tiers.hEdits` | `[]` | gate, focus | files that require H only when a line is deleted or changed (appending doesn't) |
| `tiers.m` | `[]` | gate | paths that require at least M |
| `tiers.sMaxChurn` | `400` | gate | more changed lines of code than this requires at least M |
| `tiers.churnIgnore` | docs, `*.md`, fixtures, snapshots, lockfiles | gate, focus | paths that don't count toward churn |
| `hotspots[]` | `[]` | gate, status | `{ name, paths, appendOnly? }`. A PR holds a hotspot when it modifies, removes or renames a matching file. New files never count, and neither do `appendOnly` files whose diff deletes no line. |
| `migrations.paths` | `[]` | gate, status | adding a file here takes the single migration slot |
| `pr.requiredSections` | Plan, State, Data, Impact, Decisions, Unconfirmed facts | gate | each must appear as a heading (`## X`) or bold label (`**X:**`) |
| `pr.requiredSectionsByTier` | `{ "s": ["Plan", "State", "Impact"] }` | gate | per-tier override of `pr.requiredSections`; S skips Data, Decisions and Unconfirmed facts |
| `gate.ownerReviewBlocks` | `false` | gate | `true`: an `owner-review` label holds the merge until the owner removes it (for repos where rule changes must wait for the owner) |
| `pr.impactLabel` | `Idea` | merge | the bold label whose first sentence becomes the daily-log line |
| `pr.changeQuestions` | S: `Idea`, `System`; M and H: `Idea`, `System`, `Patterns`, `Long term` | gate, status | bold labels each tier must answer in the PR (a placeholder comment counts as blank); `melon status` prints each open PR's `System` line |
| `todo.pattern`, `todo.ignore` | TODO without `#n`; `**/*.md` | gate | regex applied to added lines; globs to skip |
| `ci.workflow` | `ci.yml` | merge | the workflow to dispatch |
| `ci.requiredFor` | `["m", "h"]` | merge | tiers that need green PR CI |
| `ci.batchAfterSMerges` | `3` | merge | dispatch CI on main after this many S merges |
| `records.<name>` | GitHub (below) | merge, status, labels, records | where each record lives: `{ "kind": "github-issues" }`, `{ "kind": "github-issue", "label": "…" }` or `{ "kind": "file", "path": "…" }`. Other kinds are valid config but fail when a command needs them. |
| `batch.minIssues`, `batch.labels` | `3`; `found-by-agent`, `bug` | batch | when an area is ready to batch, and which issues are candidates |
| `staleDays` | `3` | status | a non-parked PR with no update for this long shows as stale |
| `status.untieredLabels` | `[]` | status | extra labels for issues that aren't work items (record labels are always excluded) |
| `areas` | `[]` | labels | `area:*` labels to create |
| `audits.sourceGlobs`, `audits.ignoreGlobs` | `**/src/**/*.{ts,tsx}`; tests, node_modules, dist | audit | what the scanners read |
| `audits.tokenFiles` | `[]` | audit | design-token files (literals allowed there; keys checked for use) |
| `audits.componentMaxLines` | `250` | audit | react-composition size limit |
| `audits.rulesDoc` | `null` | audit | a reference doc with numbered sections (`## 3. …`); docs-drift checks `§N` references against it |
| `audits.envExample` | `.env.example` | audit | where every env var must be listed |
| `audits.allowedHosts` | `[]` | audit | known outbound hosts (data sources, providers) |

## Records and their defaults
| Record | Default | Used by |
|---|---|---|
| `workItems` | `{ "kind": "github-issues" }` | status, batch |
| `decisionLog` | `{ "kind": "github-issue", "label": "decisions", "title": "Decision log" }` | records, labels |
| `ownerList` | `{ "kind": "github-issue", "label": "owner-attention", "title": "Owner attention" }` | records, labels |
| `direction` | `{ "kind": "github-issue", "label": "direction", "title": "Direction" }` | records, labels |
| `dailyLog` | `{ "kind": "github-issue", "label": "daily-log", "titlePrefix": "Daily log ", "per": "day" }` | merge |

Override only what differs, for example `"records": { "ownerList": { "label": "owner" } }`. Work items declare dependencies with a `Depends on: #n` line (also `Blocked by:` or `After:`), which `melon status` reads.

## Markers the CLI reads
| Marker (first line of a comment) | Posted by | Read by |
|---|---|---|
| `MELON CHECK: PASS @ <sha> (<mode>: <checks>)` | `melon check --record` | gate (S tier) |
| `TEST PLAN` | reviewer, on the issue or PR | gate (M/H) |
| `PLAN AGREED` | builder | gate (M/H) |
| `REVIEW VERDICT: APPROVE @ <sha>` / `CHANGES @ <sha>` | reviewer, on the PR | gate (M/H); the latest counts |

## Lines the CLI reads in bodies
| Line | Where | Read by |
|---|---|---|
| `Closes #n` | PR body | gate, status, ledger, merge |
| `Depends on: #n` (or `Blocked by:`, `After:`) | work item | status |
| `\| D<n> \| … \| #<work item> \|` | decision-log record, a table row; the last cell names the work items | gate, merge |
| `D<n> → <where>` (or `->`) | PR body, under Decisions | gate (a file it names must exist at the head, and the line if given); merge removes `D<n>` from the decision log |
| `Caused by: #<pr>` (or `Regressed in`, `Introduced in`) | a bug issue | merge (tags the fix in the daily log), escapes |
| `#n` in the order section (the heading that says "order"; the whole body if there's none), outside comments | direction record | status: ready work is listed by first mention; unmentioned ready work is listed apart. `melon direction place` adds `<k>. #n: <why>` there |
| `<!-- melon:next-decision D<n> -->` | decision-log record | `melon decision add` (the next id; written by it, so ids don't repeat after graduation) |

A recorded SHA covers the PR head when the head is that commit, or when the PR's only commits since are merges; commits that arrive from `main` by merging it in don't count, so merging `main` doesn't cost a new review.

## Local state
- `.melon/logs/<check>.log`: full output of the last `melon check` run (gitignored).
- `<git common dir>/melon-state.json`: the S-merge counter, shared by every worktree of the repo.
