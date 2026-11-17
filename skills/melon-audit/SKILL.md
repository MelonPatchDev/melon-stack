---
name: melon-audit
description: Run one or two whole-repo audits cheaply - a script flags suspect files, then one focused model pass judges only those. Audits - state-machines, style-drift, react-composition, privacy, docs-drift. Use every 5 merges, before a deploy, or when the owner asks for an audit.
---

# melon-audit

**A script picks the files, and you judge only those.** A whole-repo read is the expensive way to audit; don't do it.

1. **Pick 1–2 audits.** Take the ones that ran longest ago (the last orchestrator hand-off on the `direction` issue says which), or the ones the owner named. Before a deploy, always include `privacy`.
2. **Flag.** Run `pnpm melon audit <name>`. It prints the flagged files and lines, plus the question the model pass must answer. Scripts aim to catch everything, so expect false positives.
3. **Judge each flag.** Read only the flagged lines plus enough context to answer the question. Use an Explore subagent if a flag needs a cross-repo answer. Each flag ends as one of:
   - **finding:** a real problem, with evidence (`file:line` and a one-line why) and the smallest fix;
   - **noise:** why it's fine, in ≤1 line. If the same noise recurs, tune the scanner (a melon-stack issue).
4. **Extra checks the scripts can't do:**
   - `privacy`: confirm every API route is behind the auth guard. Read the router and its guard, not every handler.
   - `state-machines`: for each confirmed machine, list the states and transitions, and say whether an impossible combination can be reached.
5. **Output:**
   - Each finding becomes an issue labelled `found-by-agent tier:s area:<x>` (`tier:m` if it needs a contract or a hotspot), one paragraph each.
   - A **ground-rule break** (privacy, secrets, auth, polite fetching, data traceability) is flagged to the orchestrator as "fix before the next feature merge".
   - Post **one** comment on the `direction` issue: the audits run, flags vs findings, the issue links, and any finding that should become a lint (then run `melon-correct` on it).
   - Keep the comment to ≤15 lines.

## The audits
| Audit | The script flags | The model pass decides |
|---|---|---|
| `state-machines` | ≥3 boolean `useState` in a file; a status-like field compared against ≥3 string values across ≥2 files | Is it an implicit state machine? Can an impossible state be reached? Would one union + transition function be simpler? |
| `style-drift` | colour literals and non-hairline px outside the token files; token keys nothing references (including `var(--key)`) | Does it bypass the theme? Is the token truly orphaned? |
| `react-composition` | components over the line limit; effects that only set state; components with ≥10 props | Where would splitting, children/slots or derived state make it simpler? Only changes worth their diff. |
| `privacy` | outbound hosts not in `audits.allowedHosts`; env vars missing from `.env.example` | Does the host get user data? Is fetching polite? Is the env var documented? Plus the auth-guard check. |
| `docs-drift` | `§N` references to sections the spec doc (`audits.specDoc`) doesn't have | Which section is meant, and does the code still match it? |
