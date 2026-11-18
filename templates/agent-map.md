# Agent map

<!-- ≤3k tokens. Every agent reads this after CLAUDE.md. It describes the codebase as it is now; point to things, don't copy them. -->

## Where things live
| Path | What |
|---|---|
| `apps/…` | |

## Personas
<!-- Who uses the product, one line each: who they are, what they come to do, and what they would never want. Step 2 of the reasoning order, the reviewer's persona walk and every brief's UX effect read this. Delete the section for a repo with no users to speak of (a library, an internal script); agents then skip that step. -->
- **<persona>:** <who, what they do here> · never wants: <…>
<!-- Or one line pointing to the repo doc that already describes them. -->

## Design intent
<!-- The patterns this codebase wants more of, and the ones it wants less of, one line each with an example file. Reviewers block a change only against a line here, so keep it short and true. The orchestrator adds patterns the review accepted. Where this section is empty, the melon-mode principles apply. -->
- More of: <pattern> (e.g. `path/to/example.ts`)
- Less of: <pattern>

## Where records live
<!-- Paste the output of `melon records`. Records look forward (open work, open decisions, direction); the code and its tests document what's built. -->

## Reference docs
<!-- Current-state docs only: they describe what's true now and must match the code. -->
| Question | Read |
|---|---|
| How is number X computed? | the rules doc, §n (the section only) |
| What does term Y mean? | the glossary |

## Rules agents break most often
<!-- Rules still enforced only by prose. Each is a candidate for melon-correct; delete the line once a check enforces it. -->
1. …

## Commands
- `melon check` · `melon gate <pr>` · `melon status` · `melon records`
