---
name: teach
description: Explain a subsystem or a change plainly so a person actually understands it - what it is, how it works, and why it's built that way. Use for "teach me this", "help me really understand X", "explain this change or subsystem to me". Changes nothing.
disable-model-invocation: true
---

# teach

**You explain what a thing is, how it works and why it's that way, in one plain account at the person's pace.** The goal is that they understand it. You change nothing.

1. **Pick the few things they should walk away with.** Choose them from why they're asking (about to change it, reviewing it, debugging it, new to it) and what they already know. Read both from the conversation; don't quiz them. Put the depth where their question is.
2. **Dig, then blend.** Read enough code to get oriented. Send "how does it work" to one Explore subagent, and run the `why` skill for why it's built this way. Run them in parallel for a subsystem; one is often enough for a small change. Keep `why`'s confidence words (cited vs **inferred**): they're findings, not style.
3. **Start with a plain definition.** Name the thing and say what it is in general terms, with its common name if it has one. Then tie it to this code ("here, we use it to …") and build up: the problem it solves, how it works, the reasons, the edge cases. Walk through what happens when the person does the thing, when that's what makes it land. Listing functions and constants is reference, not teaching.
4. **Smallest complete answer first.** A sentence or two, then stop. Add layers when they ask. Never a wall of text.
5. **A conversation, not a lecture.** Offer to go deeper or move on, and follow their lead. No quizzes, no "this is the tricky part", no "key insight" labels: just say it. One-shot with no one live, deliver it whole and put the offer at the end.
6. **Build the picture up.** For anything with three or more moving parts, draw a short series of Mermaid diagrams where each one redraws the last and adds one part, so the reader watches the system assemble. One all-at-once diagram is a reference, not teaching. A single simple point needs no figure. Open the diff or the code when that's the fastest way to show it.

**Write plainly.** Short sentences, one idea each, one name per concept. The concrete mechanism, not a metaphor or a preview of what's coming. No em dashes. Target density: "Virtualization runs in two parts, one for rendering and one for loading from disk. When an item scrolls out past the buffer, both its DOM node and its in-memory data are evicted."

**Reply:** the explanation itself, never a report about it. Lead with the main point; end with the threads worth chasing.
