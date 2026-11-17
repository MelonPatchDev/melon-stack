---
name: domain-modeling
description: Sharpen a project's domain language while designing - challenge terms, test boundaries with edge cases, write settled terms to the glossary. Use when the user wants to pin down terminology or record a decision.
---

- **Glossary.** Use the project's own glossary if CLAUDE.md names one; otherwise a root `CONTEXT.md`, created when the first term is settled. One meaning per term: the term, one or two sentences on what it is, and the words to avoid. Only terms specific to this domain, no implementation details.
- **Challenge.** When a word conflicts with the glossary or is overloaded, say so and propose the canonical term.
- **Scenarios.** Invent concrete edge cases that force each boundary to be precise.
- **Check the code.** When the user says how something works, check the code agrees, and surface any contradiction.
- **Decisions.** Don't write ADRs or decision files into the repo. A settled decision for unfinished work goes in the **decision log** record (`melon records` says where): one line with its basis and a link to where it was argued, plus where it will graduate (a test, a type, a rule, or the glossary). Once the work merges, the code carries it and the entry leaves the log. Terms go in the glossary, which describes the domain as it is now.
