# Agent map

<!-- ≤3k tokens. Every agent reads this after CLAUDE.md. It describes the codebase as it is now; point to things, don't copy them. -->

## Where things live
| Path | What |
|---|---|
| `apps/…` | |

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
