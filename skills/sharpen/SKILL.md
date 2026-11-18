---
name: sharpen
description: Make a task deeper, not bigger, then rewrite the prompt for it. Use for "sharpen this", "/sharpen", or before handing a vague task to a builder or to melon-concept.
disable-model-invocation: true
---

# sharpen

I want a deeper version of this task, not a bigger one. Before rewriting it, answer four things:

1. What would a top professional in this field do here that I'm not asking for?
2. What raw material would they start from, instead of what has already been digested for me?
3. Which specific methods and tools would they use?
4. What, other than you or me, would show the result is right? Name a test, a measurement or a check that could fail.

Then rewrite my prompt to ask for exactly that, at the same scope.

The rewritten prompt asks the agent to prototype any choice an experiment can settle and to recommend an option from what it observed. It leaves product and preference choices, which no experiment settles, for me.
