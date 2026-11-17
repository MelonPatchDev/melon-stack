---
name: brainstorm
description: "Collaborative brainstorming and feature specification for software projects. Use this skill when the user wants to brainstorm a feature, plan a milestone, design a data model, flesh out project requirements, create a feature spec, or discuss what an app/system should do. Trigger on phrases like 'let's brainstorm', 'let's spec out', 'what should M2 look like', 'help me think through', 'let's plan the feature', 'I have an idea for', or any conversation where the user is describing what they want to build and needs help structuring it into a clear plan. Also use when the user wants to review or refine an existing spec."
---

# Brainstorm

Guide collaborative brainstorming sessions that produce structured, implementation-ready feature specs. Your role is thinking partner, not transcriber — challenge assumptions, surface edge cases, and help the user converge from a raw idea to a clear plan.

## How brainstorming works

A good spec emerges through conversation, not from filling in a template. The process has a natural arc:

**1. Listen and expand** — Start with the user's idea as-is. Ask clarifying questions. Then *widen* the scope: suggest adjacent concerns, edge cases, and design considerations the user may not have thought of. Frame suggestions as "I'd suggest X because Y" — have opinions, but the user has final say.

**2. Structure incrementally** — As the conversation develops shared understanding, start organizing ideas into a doc. Don't front-load structure — let it emerge from the discussion. Write it into the **work item** (the parent issue for the feature or milestone; `melon records` says where work items live), not into the repo. A spec looks forward: once the work is built, the code and its tests are the spec, and a committed spec file would only drift.

**3. Review what you wrote** — After drafting each major section, do a two-pass review:
   - **Gaps**: missing edge cases, unhandled states, implicit assumptions that need to be explicit. Ask yourself "what happens when [unusual scenario]?" and "does this break for [different user type]?"
   - **Overspecification**: details that constrain the implementer unnecessarily. Framework defaults don't need to be specified. Type signatures drift from reality — only include them for contracts that multiple components depend on. If something is just "how React works," don't spec it.

**4. Converge and park** — Resolve what can be resolved now. Explicitly park what can't — the Open Questions section is not a failure, it's a feature. Distinguish "we decided to defer this" from "we haven't thought about it yet."

## What goes in a spec

Organize by concern, not by conversation order. Each section should be independently readable:

- **Vision** — what the feature/milestone is and why it matters, in 2-3 sentences
- **Architecture Decisions** — significant choices and their rationale (tech stack, client vs server, data layer strategy). Don't just state the choice — explain why you chose it over the alternatives. "Single table with type enum" is a what; "single table with type enum because all-notifications queries become one read instead of a UNION, and adding new types is an enum value not a migration" is a decision
- **Data Model** — entities, fields, relationships, enums. Be specific here — field names, types, nullability, what's required vs optional. This is the section that benefits most from upfront rigor because mistakes here cascade into implementation
- **UI Scope** — what the user sees and interacts with, described directionally. "Card-based list with expand/collapse" is the right level. Pixel-level layouts and component hierarchies are not — those belong in implementation
- **Open Questions** — decisions that are better made with more context during implementation. Include a sentence of reasoning for each: why it's deferred and what would inform the decision

Not every spec needs every section. A small feature might just need data model + UI scope. And some features benefit from sections not listed here — use judgment:

- **State machine / lifecycle** — if the feature has entities that transition through states (pending → active → completed), spell out the transitions and rules explicitly. State machines are a magnet for bugs when left ambiguous
- **Edge cases** — when the domain has genuinely tricky boundary conditions (tied scores, timezone boundaries, concurrent mutations), an explicit edge cases section prevents the implementer from having to guess your intent. Don't list obvious cases ("what if the input is empty") — focus on domain-specific ones that require a design decision
- **Computation logic** — if the feature involves non-trivial calculations (aggregation, unit conversion, amortization), spec the algorithm precisely. This is closer to data model territory than UI territory — ambiguity here causes bugs

## The right level of detail

This is the most important calibration to get right:

| Aspect | Detail level | Why |
|--------|-------------|-----|
| Data model fields and relationships | Specific (field names, types, constraints) | Mistakes here cause rework across the stack |
| State transitions and computation logic | Specific (rules, formulas, resolution order) | Ambiguity here leads to bugs |
| Edge cases with design implications | Specific (state the case and the decision) | Implementer shouldn't have to guess intent on domain-specific boundary conditions |
| UI layout and information hierarchy | Directional ("summary bar at top, card list below") | Good enough to align on what's built, flexible enough to adapt during implementation |
| Visual design (colors, spacing, animations) | Leave to implementation | Premature decisions here get thrown out |
| API endpoints and route paths | Leave to implementation | These are implementation details that follow naturally from the data model |
| Component names and hierarchies | Leave to implementation | These change constantly during development |
| Infrastructure choices (specific databases, queues, services) | Leave to implementation unless architecturally significant | "Use Redis for X" is premature; "needs a job queue for async processing" is directional and useful |
| Type signatures and function signatures | Only for shared contracts between systems | Detailed type defs for internal functions will drift from reality — describe what the function *does* instead |

## Cross-milestone thinking

When speccing a milestone, think about what comes next. Identify data model fields, enum values, or architectural patterns that should be included *now* — even if unused — to avoid rework later. Call these out in an "Impact on M[current]" section so they don't get lost.

Example: if M2 will need an `occupancy_change` event type, add it to the M1 enum even though M1 won't have UI for it. The cost of adding it now is zero; the cost of migrating data later is real.

When speccing M2+, explicitly consider what changes are needed in the *previous* milestone's data model or architecture. A grocery list feature might need ingredient name normalization that should happen in M1's recipe model. Surface these dependencies early.

## Challenging assumptions

This is the hardest part of the skill and the most valuable. The goal is to find the gaps in the user's mental model before they become bugs or rework.

**Probe the domain model for hidden variants.** When the user describes how something works, ask yourself: "is there another way this could happen?" If they say users purchase houses with mortgages, ask about cash purchases, gifts, seller financing. If they describe a notification system for comments, ask about self-notifications, batch scenarios, and what happens when the target entity gets deleted. The most valuable questions are the ones that reveal a category the user forgot, not just a parameter they didn't mention.

**Question implicit constraints.** If the user says "challenges are 1v1," ask whether that's a deliberate v1 scope cut (and the data model should support groups) or a fundamental design choice. The answer changes the schema.

**Test state transitions.** For any entity with a lifecycle, walk through each transition and ask what triggers it, what happens to related entities, and what the edge cases are. "What happens if both participants forfeit simultaneously?" is the kind of question that prevents race condition bugs.

**Do this throughout, not just at the start.** Assumption-challenging isn't a phase — it's continuous. When reviewing a drafted data model section, look at each field and ask "what if this is null? what if this changes? what if two events create conflicting values?" When reviewing UI scope, ask "what does the user see when there's no data yet? what about 1000 items?"

## Being a good thinking partner

The value of this process is not the document — it's the thinking that goes into it. A few principles:

- **Have opinions and share them.** "I'd lean toward making this an event type rather than a separate concept, because it keeps the timeline consistent" is more useful than "we could do A or B, what do you think?" — but always frame it as a suggestion the user can override.

- **Know when to stop.** A spec is done when the data model is solid, the UI scope is clear enough to build from, and remaining unknowns are explicitly parked. Don't chase perfection — the implementation will surface things the spec can't anticipate.

- **Agree briefly, then move on.** When you agree with the user, say so in one line and advance the conversation. Don't restate their point back to them.

## What this skill does NOT do

- Generate code or implementation — that's a separate step
- Prescribe a rigid template that every spec must follow
- Make technology choices without discussing tradeoffs with the user
- Over-specify UI/UX details that belong in prototyping
- Skip the review step (draft, then review for gaps and overspecification, then refine)
