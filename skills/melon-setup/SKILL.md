---
name: melon-setup
description: Adopt melon-stack in a repository - vendor the melon CLI, write melon.config.json, create labels, write the agent-map, direction, decisions and enforcement docs, and retire repo-local copies of skills melon-stack now provides. Use when the user says "set up melon-stack", "adopt melon-stack in <repo>", or "update the vendored melon CLI".
disable-model-invocation: true
---

# melon-setup

Adoption changes how every agent in the repo works, so do it as one PR, on a branch, and label it `owner-review` if the repo uses that.

1. **Vendor the CLI:**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/cli/melon.mjs" init <repo-dir>
   ```
   Then:
   - add a script that runs it, for example `"melon": "node tools/melon/melon.mjs"` in the root `package.json`;
   - if `init` printed an ESLint line, add `'tools/melon/**'` to the `ignores` array of the flat config. `init` already handled `.gitignore`, `.prettierignore` and any legacy `.eslintignore`;
   - run the repo's formatter on `melon.config.json`;
   - **prove it:** the repo's own lint passes with the copy in place.

   Re-running `init` updates the vendored copy, keeps the config, and adds no line twice.
2. **Config.** Start from the starter `init` wrote, or from `${CLAUDE_PLUGIN_ROOT}/examples/monorepo.config.json`, and check every path against the repo (`git ls-files`). Field reference: `${CLAUDE_PLUGIN_ROOT}/docs/config.md`.
   - **checks:** what the repo's CI runs, with `paths` on the expensive ones (e2e, benchmarks);
   - **H paths: only** where a break would be systemic and hard to undo (formula code, schema and migrations, auth, raw-data stores, rate limiters). Ingestion, mapping, shared contracts and rule docs are M floors;
   - **check the tiers against history:** tier the last ~25 merged PRs with the config, and expect H to be the minority. If it isn't, the H list is too broad;
   - hotspots, migration paths, and areas (reuse existing `area:*` labels).
3. **Labels:** run `melon labels`, then `--apply` (it creates only the missing ones). Propose tiers for the open issues in one comment, or let the orchestrator assign them.
4. **Docs**, from `${CLAUDE_PLUGIN_ROOT}/templates/`. Read the existing docs once through an Explore subagent; don't paste them.
   - `docs/agent-map.md`: ≤3k tokens. What lives where, the rules agents break most, which doc answers what.
   - `docs/direction.md`: from the current plan, roadmap issue or features doc. The "why this order" and "what would change the plan" sections are the point.
   - `docs/decisions.md`: move any existing list of decisions here, **keeping its numbering** so references stay valid.
   - `docs/enforcement.md`: start with the rules the CLI and the existing tests already enforce.
5. **Process docs.** Shrink the repo's own process doc to what's specific to that repo, and point to melon-stack's design and playbooks. Update `CLAUDE.md`'s agent working rules to match:
   - the tiers;
   - the test plan in place of any orchestrator onboarding confirmation;
   - no reviewer for S;
   - the builder steps in the build playbook.

   Keep the ground rules.
6. **Retire duplicates.** Remove repo-local copies of skills melon-stack now provides (`grilling`, `domain-modeling`, `brainstorm`, `codebase-design`, `simplify-single`, and any local orchestration loop melon-mode replaces). Keep only skills that are truly specific to the repo. Carry any **lessons or "traps seen"** list from the old process into `melon-correct` as its first input; don't lose them.
7. **CI:** apply `${CLAUDE_PLUGIN_ROOT}/examples/ci-path-filters.md`:
   - skip `tier:s` PRs;
   - lint-only for docs;
   - expensive suites only when their paths change;
   - keep `workflow_dispatch` for the S-batch run on `main`.
8. **Create the `direction` issue** (label `direction`) for orchestrator hand-offs, and post the first hand-off.
9. **Prove it once:** `melon status`, and `melon gate <an open PR>` (read-only without `--fix`). Put the output summary in the PR.
