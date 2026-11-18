---
name: why
description: Answer "why is X this way" from the record, not the code - the commits, PRs and issues that introduced and changed it. Use for "why does X work this way", "why did we pick Y", "what decision does this test protect", regressions, or before reversing something that looks wrong. Use an Explore subagent for "how does X work".
---

# why

**Answer from the record, not the code.** In a melon-stack repo the reasoning lives on the issue or PR that argued it, one `git blame` away. The code tells you what; the record tells you why.

1. **Find the commits.** `git log -L <start>,<end>:<file>` for a few lines, `git log -S '<symbol>'` for a symbol, `git blame -w -C` for a file. Squash merges end in `(#<pr>)`, so each commit names its PR.
2. **Read the argument.** `gh pr view <pr> --comments` for the PR's Decisions, the reviewer's verdict and the discussion; then the issue it closes (`gh issue view <n> --comments`) for the brief and the design discussion.
3. **Tests are decisions.** For a test, find the PR that graduated a decision into it: `gh pr list --state merged --search "<test file> in:body" --json number,title`, then read its `D<n> → <where>` lines. A test named by a graduation protects that decision; changing its assertion reverses it.
4. **Still open?** Check the decision log (`melon records` says where it lives) for an entry that still governs the code.
5. **Stop when the trail is thin.** If the record says nothing, say so. Don't fill the gap from the code.

For a long trail (a subsystem, many PRs), send steps 1–3 to one Explore subagent and keep its summary.

**Reply:** what the authors wrote, cited (`PR #n`, `issue #n`, commit), in a few lines. Mark your own inferences as **inferred**. End with what the record doesn't answer.
