// melon records: where each record lives in this repo, as a table agents (and the agent map) use.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { listOpenIssues } from '../lib/github.mjs';
import { RECORDS, resolveRecords, SUPPORTED } from '../lib/records.mjs';

export const help = `melon records [--check]
  Prints where each record lives (from "records" in melon.config.json, GitHub by default), as a
  Markdown table for docs/agent-map.md.
  --check  also confirm each location exists: one open issue with the record's label, or the
           file. Exits 1 if any is missing or uses a kind the CLI doesn't support yet.`;

function where(r) {
  if (r.kind === 'github-issues') return 'GitHub issues';
  if (r.kind === 'github-issue') return `GitHub issue labelled \`${r.label}\`${r.per === 'day' ? ' (one per day)' : ''}`;
  if (r.kind === 'file') return `\`${r.path}\``;
  return `${r.kind} ${JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'kind')))}`;
}

export function main(args, config) {
  const records = resolveRecords(config);
  let ok = true;
  console.log('| Record | Lives in | Holds |');
  console.log('|---|---|---|');
  for (const [name, r] of Object.entries(records)) {
    let note = '';
    if (args.flags.check) {
      if (!SUPPORTED.has(r.kind)) {
        note = ' ✗ kind not supported by the CLI yet';
        ok = false;
      } else if (r.kind === 'github-issue') {
        const found = listOpenIssues(r.label);
        if (r.per === 'day') note = found.length ? ` ✓ #${found[0].number}` : ' · created on the first merge';
        else if (found.length === 1) note = ` ✓ #${found[0].number}`;
        else {
          note = found.length ? ` ✗ ${found.length} open issues carry the label` : ' ✗ missing';
          ok = false;
        }
      } else if (r.kind === 'file') {
        const exists = existsSync(join(config.root, r.path));
        note = exists ? ' ✓' : ' ✗ missing';
        ok &&= exists;
      }
    }
    console.log(`| ${name} | ${where(r)}${note} | ${RECORDS[name].purpose} |`);
  }
  return ok ? 0 : 1;
}
