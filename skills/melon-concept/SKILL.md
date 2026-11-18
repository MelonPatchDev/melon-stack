---
name: melon-concept
description: Turn an idea into a spec and buildable issues (briefs, tiers, dependencies), with the user or autonomously, in a melon-stack repo (one with melon.config.json). Use for "let's design X", "spec out M2", "turn this into issues", "plan the next milestone", or an outline issue with no brief.
---

# melon-concept

**Design is the cheapest place to spend tokens.** A question settled here saves a builder session, a review round and a redesign. The output is a spec and a set of issues the melon-mode orchestrator can launch. You know how to design; this skill only fixes what this process needs from the result.

The repo's `CLAUDE.md` wins over anything here. **Load the `melon-stack:melon-mode` skill first** unless this session already has it (an orchestrator does), and skip its playbook list: the tiers you propose, the bases you give decisions and the System lines you write are read by builders, reviewers and gates that work under its tiers (§1), reasoning order and change questions (§3) and principles (§5). Design lives in **records**, not the repo (`melon records` says where): the spec in a parent **work item**, settled decisions in the **decision log**, the order in **direction**.

## Mode
- **With the user** (you're the **designer**): use `grilling`. Facts come from the code, decisions from the user. An orchestrator may be running, so first read `melon status` and the open decision log, and design against the work in flight as well as `main`. You may refine an issue that's still `status:ready`; once it's `status:building`, a change is the orchestrator's checkpoint. Sign comments `[designer]`.
  - **One request** ("users want X", a piece of feedback): keep it to one issue unless the design shows more. Scope is the point of the conversation: what it means for the app, what's in and out, and what done looks like.
  - **A bug report:** reproduce it from the code, find the PR that introduced it (`git log -S`, `git blame`) and add `Caused by: #<pr>`; it's usually `tier:s`.
- **Autonomous** (expanding an outline, or the user said "decide and flag"): settle each question yourself using the reasoning order in melon-mode, and label every consequential or hard-to-reverse answer `owner-review`, so the user can overrule it later without blocking now. No one is pushing back, so before you finish, look for what the outline didn't mention: the variants of each case, the constraints it assumed, every state transition, and what happens when data is missing or unknown.

## What the design must get right
- **Start from the code on `main`,** never from memory or an old outline. Use an Explore subagent if the idea spans packages.
- **Detail where ambiguity causes bugs, nowhere else.** Be specific about data (entities, fields, nullability), state transitions, computation rules, and domain edge cases that need a decision. Keep UI directional. Leave routes, component names, visual design and internal function signatures to the builder. Over-specifying costs every reader tokens and constrains the builder.
- **Terms:** a new or overloaded word gets one meaning in the glossary, in the same change that introduces it.
- **Ask the change questions of each slice** (melon-mode §3), above all **System** and **Long term**: what new state, contracts and data paths it adds, who else they affect, and what it will make hard to change later. Answered here, they're a line in the brief; discovered in review, they're a fix round.
- **Decide the tier as you go:** would a break here be systemic and hard to undo (formula code, stored format, auth)?
- **Park what you can't settle,** each with why it's deferred and what would decide it. A parked question is fine; a guessed answer isn't.
- **Stop** when the data model is solid, the UI is clear enough to build, and the unknowns are parked.
- **Design related issues together** when they share a data model or contract; designing them separately means redesigning one later.

## Write it down
- **The spec** goes into one parent work item that every slice links to. Never commit it: once built, the code and tests are the spec.
- **Each hard-to-reverse decision** goes in the decision log with `melon decision add`: the decision, its basis, where it was argued, **where it will graduate** (a test, type, rule or reference doc), and the work item(s) it's for. A decision with no plausible graduation probably doesn't need logging.

## Slice into issues
- **One issue = one complete, user-visible slice** with its tests. Never split by layer. Split anything likely over ~3,000 changed lines (not counting fixtures).
- **Each issue gets a brief** (`templates/brief.md`), including `Depends on:`, expected size, owned paths, the stop point, hotspots, design excerpts with **`file:line` references to the code on `main`**, the decision-log entries it settles, and acceptance criteria.
- **Labels:** `tier:*`, `area:*`, and `status:ready` once the brief is complete. Note any hotspot or migration slot each will hold.
- **H issues** need no separate design agent: the H reviewer checks the brief against the code in its first phase.

## Direction
Fill the brief's **Asked for** line: who asked, why, and the urgency they stated. Place the work in the direction record if you can say where it sits and why (for which persona, the bets it rests on, **what result would change the plan**): `melon direction place #n --why "…" [--after #m]`, never a hand edit of the order. Otherwise leave it out, and `melon status` lists it for the orchestrator to place. Re-read an issue's labels just before refining its brief: `status:building` means a builder has it.

## Reply
≤10 lines: the spec link, the issues with their tiers, whether each is placed in the direction record, the `owner-review` decisions, and the parked questions.
