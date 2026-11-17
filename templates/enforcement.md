# Enforcement

<!-- Each rule, and what enforces it. A rule enforced only by "docs" is a candidate for the next melon-correct pass. -->

| Rule | Enforced by | Level | Since |
|---|---|---|---|
| Tier never below what paths require | `melon gate` (tier label) | gate | melon-stack 0.1 |
| No TODO without an issue number | `melon gate` (TODOs) | gate | melon-stack 0.1 |
| Two open PRs never modify the same hotspot | `melon gate` (hotspots) | gate | melon-stack 0.1 |
| One migration in flight | `melon gate` (migration slot) | gate | melon-stack 0.1 |
