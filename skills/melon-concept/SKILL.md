---
name: melon-concept
description: Turn an idea into a spec and then into buildable issues - grill the design (with the user, or autonomously), pin the domain language, write the spec at the right level of detail, and slice it into issues with briefs, tiers and dependencies. Use for "let's design X", "spec out M2", "turn this into issues", "plan the next milestone", or when the orchestrator meets an outline issue.
---

# melon-concept

**Design is the cheapest place to spend tokens.** A question settled here saves a builder session, a review round and a redesign. This skill runs before any builder starts. Its output is a spec and a set of issues the [melon-mode](../melon-mode/SKILL.md) orchestrator can launch.

The repo's `CLAUDE.md` wins over anything here. Design lives in **records**, not in the repo: the spec in the parent **work item**, settled decisions in the **decision log**, the order in **direction** (`melon records` says where each lives). Only current-state reference docs (the glossary, the rules doc) change in the repo.

## Pick the mode
- **With the user** (they're here and want to shape it): the `grilling` loop. One question at a time, each with your recommended answer; wait for theirs. Look facts up in the code instead of asking.
- **Autonomous** (the orchestrator expanding an outline, or the user said "decide and flag"): **self-grill**. Ask each question yourself, answer it from the code, the docs and the reasoning order below, and record it. Label every consequential, controversial or hard-to-reverse answer `owner-review`, so the user can overrule it later without being blocked now.

**Reasoning order** (what "correct" means, in both modes):
1. the ground rules (`CLAUDE.md`);
2. the personas and what each would never want (the repo's features doc);
3. the user stories, UX effect and acceptance criteria already written;
4. precedent: the code, its tests, and the open decision-log entries;
5. the repo's tie-breakers.

A call that rests on none of these is a **taste call**: make it, and label it "taste call".

## 1. Ground it in the code on main
Before the first question, read the code the idea touches, through an Explore subagent if it spans packages. **Never design from memory**; outlines written weeks ago go stale. Note what exists, which modules are deep or shallow (see `codebase-design`), and which hotspots it would touch.

## 2. Walk the design tree
Resolve dependencies in order (data before UI, contracts before callers). For each branch:
- **Data shape first:** entities, fields, nullability, states and transitions, computation rules. These need to be specific; ambiguity here causes bugs.
- **Domain language** (`domain-modeling`): challenge each new or overloaded word against the glossary. Invent concrete edge cases that force each boundary to be precise. Settled terms go to the glossary.
- **Seams** (`codebase-design`): where the new behaviour lives, and whether it deepens an existing module or adds a shallow one.
- **What can't break:** for each piece, would a break be systemic and hard to undo (formulas, stored format, auth)? That sets the tier later.
- Name each **open question** with why it's deferred and what would decide it. Parking a question is a feature; guessing an answer isn't.

## 3. Write the spec
Use the `brainstorm` spec format and its detail table: specific for the data model, state machines, computation logic and domain edge cases; directional for UI; left to implementation for routes, component names and visual design. Write it into **one parent work item** that every slice links to, so builders read one spec section instead of the conversation. Never commit it to the repo: once built, the code and tests are the spec.

Each hard-to-reverse decision gets a line in the **decision log**: the decision, its basis, a link to where it was argued, and **where it will graduate** (a test that fails if it's reversed, a type, a lint or gate rule, a ground rule, or a reference doc). A decision with no plausible graduation probably doesn't need logging.

**Design related work together.** If two planned issues share a data model or contract, design them in one pass; designing them separately means redesigning one later.

## 4. Slice into issues
- **One issue = one complete, user-visible slice** with its tests and docs. Never split by layer (schema, then API, then UI). Split anything likely over ~3,000 changed lines (not counting fixtures) into separate user-visible slices.
- **Each issue gets a brief** (`templates/brief.md`): goal, a done check that can pass or fail, expected size, **`Depends on:`**, owned paths, stop point, hotspots, UX effect, **design excerpts with `file:line` references to the code on main**, the decision-log entries it settles, and acceptance criteria.
- **Tier each issue:** S (small, no risky path), M (the default), H (only where a break would be systemic). Check it against the repo's `melon.config.json` floors. Label `tier:*`, `area:*`, and `status:ready` once the brief is complete.
- **Dependencies:** write `Depends on: #n` in each brief; `melon status` uses it to show what's ready and what each item unlocks. Note which hotspots or the migration slot each will hold, so the orchestrator can schedule parallel work without clashes.
- **H issues** get a design check before building: the H reviewer's first phase verifies the brief's claims against the code (see the review playbook), so no separate design agent is needed.

## 5. Update direction
Add the new work to the **direction** record: where it sits in the order, why, which persona it serves, the bets it rests on, and **what result would change the plan**. A fresh orchestrator must be able to explain the order from that record alone.

## Reply
≤10 lines: the spec link, the issues with their tiers, the decisions labelled `owner-review` (autonomous mode), and the open questions.
