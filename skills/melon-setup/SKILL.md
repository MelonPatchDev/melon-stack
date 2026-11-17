---
name: melon-setup
description: Adopt melon-stack in a repository - vendor the melon CLI, write melon.config.json, set up the records (direction, decision log, owner list) and labels, triage any existing decision list, write the agent map, and retire repo-local copies of skills melon-stack now provides. Use when the user says "set up melon-stack", "adopt melon-stack in <repo>", or "update the vendored melon CLI".
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
3. **Records.** Decide where each record lives (`records` in the config; the defaults are GitHub issues): the work items, the decision log, the owner list, the direction, and the daily log. Then:
   - run `melon labels --apply`; it creates only the missing labels, including the records';
   - create each record issue that doesn't exist yet, from `${CLAUDE_PLUGIN_ROOT}/templates/`: **direction** (the current plan, roadmap issue or features doc, condensed; "why this order" and "what would change the plan" are the point), **decision log**, and **owner list** (reuse an existing owner issue if there is one);
   - `melon records --check` must pass.

   Propose tiers and `Depends on:` lines for the open issues in one comment, or let the orchestrator assign them.
4. **Triage any existing decision list** (a "Settled" list, an ADR folder, a decisions doc). Nothing moves into the repo. Sort each entry:
   - **graduate it:** it guards against a plausible future change, so it becomes a test that fails if it's reversed, a type, a lint or gate rule, a ground rule in `CLAUDE.md`, or a line in a reference doc (the glossary, the rules doc). Batch these into S-tier work items;
   - **keep it open:** it governs unfinished work, so it goes in the decision log with where it will graduate;
   - **drop it:** the code already makes it obvious, and nobody would plausibly reverse it.

   Then remove the old list or folder. The reasoning stays in the issues and PRs that argued it.
5. **The one repo doc: `docs/agent-map.md`** (template in `${CLAUDE_PLUGIN_ROOT}/templates/`), ≤3k tokens: what lives where, the `melon records` table, which reference doc answers what, and the rules agents break most. Read the existing docs once through an Explore subagent; don't paste them. Repo docs describe the code as it is now. Plans, specs, decision logs and roadmaps are records, not files.
6. **Process docs.** Shrink the repo's own process doc to what's specific to that repo, and point to melon-stack's design and playbooks. Update `CLAUDE.md`'s agent working rules to match:
   - the tiers;
   - the test plan in place of any orchestrator onboarding confirmation;
   - no reviewer for S;
   - the builder steps in the build playbook;
   - records instead of repo docs for plans and decisions.

   Keep the ground rules.
7. **Retire duplicates.** Remove repo-local copies of skills melon-stack now provides (`grilling`, `domain-modeling`, `brainstorm`, `codebase-design`, `simplify-single`, and any local orchestration loop melon-mode replaces). Keep only skills that are truly specific to the repo. Carry any **lessons or "traps seen"** list from the old process into `melon-correct` as its first input; don't lose them.
8. **CI:** apply `${CLAUDE_PLUGIN_ROOT}/examples/ci-path-filters.md`:
   - skip `tier:s` PRs;
   - lint-only for docs;
   - expensive suites only when their paths change;
   - keep `workflow_dispatch` for the S-batch run on `main`.
9. **Prove it once:**
   - **two worktrees at once:** run `melon check --full` in two worktrees side by side, each with its own ports and database from the environment, and confirm worktrees and local settings are git-ignored. Parallel builders depend on this;
   - `melon status`, and `melon gate <an open PR>` (read-only without `--fix`);
   - put the output summary in the PR, and post the first hand-off on the direction record.
