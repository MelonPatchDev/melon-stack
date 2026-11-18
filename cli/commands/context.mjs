// melon context: how full an agent's context is now, from its own session transcript. Agents
// can't see their context size; this lets a builder decide to hand back at a milestone.
import { collect, fmt } from '../lib/ledger.mjs';
import { transcriptRoot } from './ledger.mjs';

const DEFAULT_LIMIT = 150_000;

export const help = `melon context <issue> [--role builder|reviewer|…] [--limit <tokens>] [--projects <dir>]
  The context size at the latest call of the most recent agent working on the issue (a subagent
  named "builder #<issue>", or a session on a branch "<issue>-…"), from its transcript.
  Exit 1 when it's over --limit (default ${DEFAULT_LIMIT}): hand back at this milestone, and a
  fresh agent continues from the PR's Plan and State.
  Run it where the agents run; transcripts live in ~/.claude/projects.`;

export function main(args, config) {
  const issue = Number(args.positional[0]);
  if (!issue) {
    console.log(help);
    return 2;
  }
  const limit = Number(args.flags.limit ?? DEFAULT_LIMIT);
  const role = typeof args.flags.role === 'string' ? args.flags.role : null;
  const mine = collect(transcriptRoot(config), args.flags.projects)
    .filter((t) => t.issues.includes(issue) && (!role || t.role === role))
    .sort((a, b) => String(a.last ?? '').localeCompare(String(b.last ?? '')));
  const t = mine.at(-1);
  if (!t) {
    console.log(`No transcript found for #${issue}${role ? ` (${role})` : ''}.`);
    return 0;
  }
  const over = t.ctx > limit;
  console.log(
    `${t.role} #${issue}: ${fmt(t.ctx)} context now (peak ${fmt(t.peak)}, ${t.calls} calls)${over ? ` — over ${fmt(limit)}: hand back at this milestone` : ''}`,
  );
  return over ? 1 : 0;
}
