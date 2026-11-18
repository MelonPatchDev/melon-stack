---
name: melon-verify
description: Create or maintain a repo-local verify-<app> skill that launches and drives the real app and captures text evidence. Use for "create a verify skill", "how do agents drive this app", UI or CLI acceptance criteria nothing can prove yet, or a maintain pass.
---

# melon-verify

**A one-time harness every later PR reuses.** Builders prove UI and CLI acceptance criteria with it, reviewers reproduce with it (level 5 of the review ladder), and bug fixes reproduce with it first. Run **create** once per repo and **maintain** in the audit rotation.

The generated skill is read cold, mid-task, by an agent that has never seen the app. Write it for that reader.

## Create

### 1. Interview the repo, not the user
Answer these from the code. Ask the user only what you can't observe.
- **Surface:** what a user touches: web UI, CLI or TUI, API, desktop, library. Pick the primary one and note the rest.
- **Run:** the repo's own dev command (package scripts, Makefile, README). Ports, env vars, seed data, auth.
- **Drive:** existing harnesses first (Playwright or Cypress specs, PTY helpers, curl-able endpoints, a debug port). Only then a generic recipe: Playwright or CDP for web, tmux or a PTY for CLI and TUI, HTTP for services.
- **Observe:** text evidence: ARIA snapshots, response bodies, stdout, stderr and exit codes, DB rows, logs.
- **Isolate:** melon-stack runs up to three builders at once, each in its own worktree with its own ports and DB name. Launch must take those as parameters. If two instances can't run side by side, say so in the skill: refusing to drive a shared instance beats corrupting someone's run.

If the checkout doesn't build or start, fix that first or report exactly why. A skill written against a broken base teaches wrong steps.

### 2. Write the skill
Write `.claude/skills/verify-<app>/SKILL.md`. Its frontmatter `description` names the app, the surface and when to use it. Sections, each from what step 1 found, with no placeholders:
- **Launch:** the exact command, parameterised by port and data dir or DB name, from an empty data dir through migrations and seed data. How to tell it's *usable*, not just answering. Teardown. For a short-lived CLI: build once, then each drive in its own PTY session.
- **Doctor:** one read-only check that this instance is worth driving: process up, right build, port owned by this run, auth valid. Run it first, and again after anything surprising.
- **Drive:** the harness recipe with this repo's real selectors and commands. Prefer stable handles (ARIA roles and names, data attributes, prompt strings, routes) over coordinates and tab order.
- **Evidence:** what to capture and where (`.melon/verify/<issue>/`, gitignored). Drive the real user path, not internal setters or test-only endpoints. Capture the action and the resulting state. Check side effects (rows written, files, outbound calls) as well as what's visible. Mocks only where a production boundary already isolates the outside system. If the safe path is a dry run, observe what it really skips rather than trusting its name. Screenshots only when an issue asks for them.
- **Cleanup:** kill what this run started, never by process name. Cleanup removes instances and scratch state, never the evidence.
- **Helpers:** any script the skill ships is executable, and the skill shows how to call it.

### 3. Seed the feature map
Write `.claude/skills/verify-<app>/features/README.md` (baseline preconditions, driving conventions, proof rules, an index, and `Verified at: <sha>`), then one file per user-facing feature, starting with the top 3–5 from routes, commands or menus. Each feature file has a one-paragraph description, then:
- **Code:** the source paths behind it (maintain uses these to see what changed);
- **Sub-features:** short ids, one line each;
- **How to get to it:** every user entry point;
- **Driving it:** preconditions, then each user action paired with its exact command and the observable result;
- **Gotchas:** traps that waste or invalidate a run (debounce, focus, default output formats).

If seed data lacks what a journey needs, the journey reports a failure and the reason goes in Gotchas. Never weaken a journey to make it pass.

### 4. Prove it before handing it over
Follow the generated skill once, end to end: launch, doctor, drive one mapped feature, capture evidence, clean up. Then confirm the evidence still exists. Fix what fails, and run the generated cleanup after every failed attempt. A verify skill that was never run is a draft.

### 5. Wire it in
- Add a line to `docs/agent-map.md`: "Driving the app: the `verify-<app>` skill."
- A journey that builders keep driving by hand should become a UI assertion test on seed data. A test runs free on every PR; a drive costs a turn. Suggest those as `tier:s` issues.

**Reply:** the skill path, the feature driven in step 4 and its evidence path, and what isn't covered.

## Maintain
**A feature map goes stale as soon as the app changes.** Run this in the audit rotation, or when a builder reports that the map was wrong.

1. **Scope by change.** For each feature, `git diff --stat <Verified at>..HEAD -- <its Code paths>`. Unchanged features skip the source read, but still get driven in step 3.
2. **Source read.** One Explore subagent reads the changed features' code against their files and returns, per feature: likely drift with `file:line`, missing entry points, or none. Sweep recent merges for user-facing surfaces the map lacks, and call one missing only with a concrete source path.
3. **Live pass.** Drive every feature once, including those with unchanged code. Doctor before the first drive and after any failed one. Keep the evidence through every cleanup, and leave nothing running after the last drive.
4. **Triage.**
   - The map describes the app wrongly: **drift**, fix the map.
   - The app works but the harness can't drive it: **harness gap**, fix the harness and drive it again.
   - The app is broken: **product bug**. Open a `found-by-agent` issue, with `Caused by: #<pr>` if `git log` shows which merge did it. Never paper over it in the map.
5. **Ship or stop.** Edit only the verify skill's own directory. Proven corrections go in one `tier:s` PR, with `Verified at` moved to the head you drove. If nothing needs changing, open no PR.

**Reply:** clean, changed (the PR) or blocked (exactly what blocked it); features driven; drift fixed; product bugs filed.
