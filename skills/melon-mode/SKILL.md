---
name: melon-mode
description: Shared rules and the playbook router for agent work in a melon-stack repo. Use at the start of any orchestrator, builder or reviewer task, and for "orchestrate", "build issue #n", "review PR #n", "pick up PR #n", "pause".
---

# melon-mode

The repo's `CLAUDE.md` and ground rules win over anything here. The scripted half is the `melon` CLI (`melon <cmd> --help`; most repos expose it as `pnpm melon` or `npm run melon --`). Budget is the constraint: do the useful work with the fewest tokens.

## 1. Know your role and the tier
- **Role:** the **orchestrator** chooses what starts, writes briefs, assigns tiers and runs `melon merge`, and never reviews code; a **builder** builds one issue or one maintenance batch; a **reviewer** writes the test plan, then the verdict, and never writes the feature; a **designer** turns a request into work items with the user (`melon-concept`) and doesn't start agents. With no orchestrator (one interactive session asked to build or run work), you are it: read the orchestrate playbook. A session designing with the user is the designer, not the orchestrator.
- **Tier** is the issue's `tier:s|m|h` label, set by the orchestrator. The change can only raise it (`melon gate --fix`), and only the orchestrator lowers it.
  - **S:** small changes (no M/H path, no held hotspot, ≤ `sMaxChurn` lines of code). No reviewer agent and no PR CI; `melon check --record` is the evidence. A short brief and fewer PR sections (Plan, State, Impact).
  - **M:** the default. The reviewer writes the test plan before seeing code, and the builder covers it without waiting for it; one review pass, at most one fix round, CI once.
  - **H:** only where a break would be systemic and hard to undo (formula code, stored format, auth). As M, but the plan is agreed before code and up to two fix rounds, plus a design check before building, an in-depth review of the focus files (`melon focus`), golden tests, and `owner-review` for rule changes.

## 2. Pick the playbook
If your prompt names your playbooks, read those and skip this. Otherwise read only the one you need, from `${CLAUDE_SKILL_DIR}/playbooks/`:
- `orchestrate.md`: choosing work, launching agents, merging, hand-off; also solo use, the records, and the other skills;
- `build.md` for any build, plus one for the task: `bug-fix.md`, `feature.md`, `refactor.md`, `systemic.md` (formula code, stored format, auth), `maintenance-batch.md` or `perf.md` (none for docs or copy);
- `review.md`: the test plan or the verdict;
- `pickup-and-pause.md`: resuming someone's work, or stopping cleanly.

Any role may use `why` (the reasoning behind code, from its PRs and issues) and the repo's `verify-<app>` skill when it has one. **Templates** named in the playbooks (`templates/<name>.md`) are in `${CLAUDE_PLUGIN_ROOT}/templates/`.

## Records
Plans and open decisions live in forward-looking **records** in the tracker (work items, the decision log, the owner list, direction, the daily log); `melon records` says where each lives. The repo holds only docs that describe what's true now (`CLAUDE.md`, the agent map, the glossary, the rules doc); see principle 11.

## 3. Reasoning order (what "correct" means)
Every judgment call, by any role, rests on the first of these that settles it:
1. the ground rules (`CLAUDE.md`);
2. the personas and what each would never want (the agent map's Personas, or the doc it points to for them; skip this step if the repo has neither);
3. the issue's user stories, UX effect and acceptance criteria;
4. precedent: the code, its tests, and the open decision-log entries;
5. the repo's tie-breakers.

A call that rests on none of them is a **taste call**: make it, and list it in the PR's Decisions as "taste call".

### The change questions
Every role asks these of a change, each at the point where it decides:
- **Idea:** what is the main idea?
- **System:** what changes beyond this module, and who else does it affect? A new place for state, a new contract, a new data path, an extension point, a product-specific special case.
- **Patterns:** does it follow the design intent (the agent map's Design intent, or these principles where the repo states none), or work against it? If it adds a pattern, should the codebase have more of it?
- **Long term:** what does it unlock, what does it constrain, and what will be hard to change later?
- **Bugs, tests, types:** these are system changes too. Is a bug a sign of a gap in the design? What do the tests and types say about the contracts between parts?

Each role's playbook says where it asks them and what an answer triggers: build (checkpoints), review (your own System line before reading the PR's), orchestrate (briefs, colliding System lines, Design intent).

## 4. Context discipline (the main cost lever)
Everything you read is paid for again on every later call.
- **Read order:** `CLAUDE.md`, then `docs/agent-map.md`, then the issue's **brief**, then the code you own. Open other docs only when a step needs them, and read the section, not the file.
- **Wide questions** ("where is X used", "how does Y work across packages") go to an Explore subagent. Keep its summary, not the file dumps.
- **Never paste raw logs.** `melon check` prints only failures, and full logs are in `.melon/logs/`; `grep` them.
- **Don't re-read** a file you just edited, or a doc you've already summarised.
- **Prefer a script to reasoning** for anything mechanical: `melon gate` exists so you don't think about labels or hotspots.
- **Long jobs** (backfills, data runs) run in the background and write a status file. Check it at milestones; never wait inside a turn.

## 5. Principles
These are opinions, not a craft manual: each corrects a default that costs this process tokens or rots the codebase. You know how to engineer; apply these where your default differs.
1. **Smallest change that solves it.** No speculative options, fields or layers. *(Counters building for imagined futures.)*
2. **Fix root causes, every occurrence.** A guard is a fix only when the state it catches is legitimate. If finding the cause took a deep dig, propose the cheap always-on signal (an assertion, a log line, a check) that would have shown it at first look. *(Counters patching the symptom.)*
3. **Prove it with a test** that fails without the change. *(Counters "it compiles" and "looks right".)*
4. **Test at the interface.** A good test fails when you break the behaviour and keeps passing when you change only the internals; rewrite or delete one that doesn't. Never delete a test a decision graduated into, or one the test plan requires. *(Counters piling up tests on internals.)*
5. **Prefer deep modules:** a small interface with a lot behind it, so an agent can understand a capability from one interface. *(Counters shallow wrappers, which make every task read more files.)*
6. **No seam without a second adapter;** a test double counts as one. One implementation and no test that swaps it is indirection, not flexibility. *(Counters abstracting "for later".)*
7. **Migrate callers, then delete the old path.** No compatibility shims within one repo. *(Counters keeping both.)*
8. **Attack the premise.** After two failed fixes that share a premise, test the premise. *(Counters fix loops.)*
9. **Decide reversible calls; ask only for owner-only actions** (money, accounts and keys, legal, commercial use, new user data). *(Counters asking.)*
10. **Unknown is a value.** Never invent data; store unknown and flag it. *(Counters plausible guesses.)*
11. **The code is the documentation.** Never commit decision logs, ADRs, specs, roadmaps or summaries. When work merges, each decision it implemented *graduates* into a test, type, lint or gate rule, ground rule or reference-doc line, and leaves the decision log; the reasoning stays on the issue or PR. *(Counters writing history into the repo.)*
12. **Encode lessons in structure.** A recurring mistake becomes a type, lint, gate rule or test, not more prose. *(Counters adding rules to read.)*
13. **Build the lever.** Beyond a couple of edits, write the codemod, script or generator that does them: prove it on the first unit, then rerun it. The tool is also what the reviewer reruns. *(Counters editing by hand, which costs a turn per edit.)*
14. **Explain the number.** Before trusting a measurement, name what limits it, rule out that it measured something else (errors, cached or skipped work, noise), and keep the run count and spread with it. *(Counters believing the first number.)*

## 6. Replies
- Final messages: ≤10 lines, evidence (command + result, `file:line`), and what's next or blocked.
- Comments end with your role tag (`[builder #n]`, `[reviewer #n]`, `[designer]`, `[orchestrator]`).
- Say each thing once and link instead of repeating.
