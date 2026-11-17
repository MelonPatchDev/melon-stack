---
name: melon-concept
description: Turn an idea into a spec and buildable issues - settle the design (with the user via grilling, or autonomously), write the spec into a work item, and slice it into issues with briefs, tiers and dependencies. Use for "let's design X", "spec out M2", "turn this into issues", "plan the next milestone", or when the orchestrator meets an outline issue.
---

# melon-concept

**Design is the cheapest place to spend tokens.** A question settled here saves a builder session, a review round and a redesign. The output is a spec and a set of issues the melon-mode orchestrator can launch. You know how to design; this skill only fixes what this process needs from the result.

The repo's `CLAUDE.md` wins over anything here. Design lives in **records**, not the repo (`melon records` says where): the spec in a parent **work item**, settled decisions in the **decision log**, the order in **direction**.

## Mode
- **With the user:** use `grilling`. Facts come from the code, decisions from the user.
- **Autonomous** (expanding an outline, or the user said "decide and flag"): settle each question yourself using the reasoning order in melon-mode, and label every consequential or hard-to-reverse answer `owner-review`, so the user can overrule it later without blocking now.

## What the design must get right
- **Start from the code on `main`,** never from memory or an old outline. Use an Explore subagent if the idea spans packages.
- **Detail where ambiguity causes bugs, nowhere else.** Be specific about data (entities, fields, nullability), state transitions, computation rules, and domain edge cases that need a decision. Keep UI directional. Leave routes, component names, visual design and internal function signatures to the builder. Over-specifying costs every reader tokens and constrains the builder.
- **Terms:** a new or overloaded word gets one meaning in the glossary, in the same change that introduces it.
- **Decide the tier as you go:** would a break here be systemic and hard to undo (formula code, stored format, auth)?
- **Park what you can't settle,** each with why it's deferred and what would decide it. A parked question is fine; a guessed answer isn't.
- **Stop** when the data model is solid, the UI is clear enough to build, and the unknowns are parked.
- **Design related issues together** when they share a data model or contract; designing them separately means redesigning one later.

## Write it down
- **The spec** goes into one parent work item that every slice links to. Never commit it: once built, the code and tests are the spec.
- **Each hard-to-reverse decision** gets a decision-log line: the decision, its basis, where it was argued, **where it will graduate** (a test, type, rule or reference doc), and the work item(s) it's for. A decision with no plausible graduation probably doesn't need logging.

## Slice into issues
- **One issue = one complete, user-visible slice** with its tests. Never split by layer. Split anything likely over ~3,000 changed lines (not counting fixtures).
- **Each issue gets a brief** (`templates/brief.md`), including `Depends on:`, expected size, owned paths, the stop point, hotspots, design excerpts with **`file:line` references to the code on `main`**, the decision-log entries it settles, and acceptance criteria.
- **Labels:** `tier:*`, `area:*`, and `status:ready` once the brief is complete. Note any hotspot or migration slot each will hold.
- **H issues** need no separate design agent: the H reviewer checks the brief against the code in its first phase.

## Update direction
Add the work to the direction record: where it sits, why, for which persona, the bets it rests on, and **what result would change the plan**.

## Reply
≤10 lines: the spec link, the issues with their tiers, the `owner-review` decisions, and the parked questions.
