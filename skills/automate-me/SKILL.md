---
name: automate-me
description: Turn the user's working style into a personal -mode skill agents follow (e.g. "sam-mode"), from their session history plus a few questions; or refresh an existing one. Use for "automate me", "create/update my -mode skill", "capture how I work".
disable-model-invocation: true
---

# automate-me

**Write down how the user works, so agents work that way without being told each time.** The output is one `<handle>-mode` skill.

## What goes where
In a melon-stack repo, not every preference belongs in a mode skill:
- **What "correct" means** for the product (a rule the change must obey) → `CLAUDE.md` ground rules, where the reasoning order reads it first.
- **Process knobs** (tiers, hotspots, checks) → `melon.config.json`.
- **Working style** (reply length, tone, autonomy, how they like options laid out, what "done" means to them) → the mode skill.

Route the first two to the user as suggestions. This skill writes only the third.

## Flow
0. **Existing skill?** Look for `.claude/skills/*-mode/SKILL.md` and `~/.claude/skills/*-mode/SKILL.md`. If one exists, update it unless the user asks to start over. In update mode, mine only history since its last edit (`git log -1 --format=%cI <path>`) and ask what changed, not what to capture from zero.
1. **Mine the history.** Session transcripts are `~/.claude/projects/<repo path with / and . as ->*/*.jsonl` (worktrees share the prefix). Read only this repo's. Give one Explore subagent the last 2–4 weeks: grep for the user's corrections and stated preferences first, then read only those regions. Signals:
   - reply preferences: length, tone, format, "simpler please";
   - autonomy: what they let agents decide, what they always want asked;
   - verification: what "done" means to them;
   - code and prose discipline;
   - process: worktrees, commits, PRs.

   It returns patterns with evidence (session id and a quote). **Keep a pattern only if it shows up in two or more sessions.**
2. **Ask.** One or two `AskUserQuestion` rounds, 4–6 options each, multi-select for categories. Then one free-text question for anything the options missed. Never 20 questions.
3. **Draft.** Write `.claude/skills/<handle>-mode/SKILL.md` (or `~/.claude/skills/` for a personal one; ask which). The frontmatter `description` triggers on their handle and `/<handle>-mode`, not on generic words. Set `disable-model-invocation: true` unless they want it on every turn. Use only the sections they have a real, non-default rule for.
4. **Cut and iterate.** Show the draft and take feedback. Cut every line a capable model would follow anyway. A mode skill is a short list of differences from the default, not a manual.
5. **Land it** on a branch. Don't push without the user's go.

## Guardrails
- One conversation isn't a pattern. A preference stated once and contradicted elsewhere is noise.
- Reference other skills by name; don't paste their content.
- Write "the user" in rules, not the user's name.
- Judge the result by asking the user whether it reads like them. No benchmark.
