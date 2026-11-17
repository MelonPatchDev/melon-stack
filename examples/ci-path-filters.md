# CI changes for melon-stack tiers

CI minutes are a budget. melon-stack's rules:
- **S-tier PRs don't run PR CI.** `melon check --record` is their evidence, and one run on `main` covers each batch of S merges.
- **M/H run once, when `melon merge` marks the PR ready.**
- **Within a run, skip what the change can't affect.**

The snippets below use only `actions/checkout` and shell, with no new third-party action. They're written for a pnpm monorepo with a Postgres-backed API and a Playwright e2e suite; adapt the paths.

## 1. Skip S-tier PRs; keep manual dispatch for the main batch run
```yaml
on:
  pull_request:
    types: [ready_for_review]
  workflow_dispatch:

jobs:
  checks:
    # S-tier PRs merge on recorded local checks; melon merge dispatches a run on main per batch.
    if: github.event_name != 'pull_request' || !contains(github.event.pull_request.labels.*.name, 'tier:s')
```
Put the same `if:` on every job, including `deploy-readiness`.

## 2. Work out what changed, once
```yaml
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - id: changed
        name: Which areas changed
        run: |
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            base="origin/${{ github.event.pull_request.base.ref }}"
          else
            base="HEAD~1"   # dispatch on main: the batch's last merge; widen with an input if needed
          fi
          files=$(git diff --name-only "$base"...HEAD)
          has() { echo "$files" | grep -Eq "$1" && echo true || echo false; }
          echo "docs_only=$(echo "$files" | grep -Evq '^(docs/|.*\.md$)' && echo false || echo true)" >> "$GITHUB_OUTPUT"
          echo "web=$(has '^(apps/web/|apps/api/|packages/contracts/|packages/ui/|packages/db/src/seed/)')" >> "$GITHUB_OUTPUT"
          echo "bench=$(has '^packages/core/')" >> "$GITHUB_OUTPUT"
          echo "deploy=$(has '^(deploy/|compose\.prod\.yml|scripts/.*\.sh|Dockerfile|apps/.*/Dockerfile|packages/db/migrations/)')" >> "$GITHUB_OUTPUT"
```

## 3. Gate the expensive steps
```yaml
      - run: pnpm lint
      - if: steps.changed.outputs.docs_only != 'true'
        run: pnpm typecheck
      - if: steps.changed.outputs.docs_only != 'true'
        run: pnpm test
      - if: steps.changed.outputs.bench == 'true'
        run: pnpm --filter ./packages/core bench
      - if: steps.changed.outputs.docs_only != 'true'
        run: pnpm build
      - if: steps.changed.outputs.web == 'true'
        run: pnpm test:e2e
```
For `deploy-readiness` (the most expensive job), compute the same `changed` output in a small first job and add `needs: changed` with `if: needs.changed.outputs.deploy == 'true'`.

## 4. The main batch run
`melon merge` dispatches `gh workflow run ci.yml --ref main` after `ci.batchAfterSMerges` S merges. On `main`, the diff base above is only the last commit. To cover the whole batch, either run everything on dispatch (simplest: treat `workflow_dispatch` as "all areas changed"), or add a `since` input and let `melon merge` pass the SHA of the last covered merge. Start with "run everything"; it's one run per batch.
