// melon records: where each record lives in this repo, as a table agents (and the agent map) use.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { editIssueBody, listOpenIssues } from '../lib/github.mjs';
import { decisionEntries, record, RECORDS, resolveRecords, SUPPORTED } from '../lib/records.mjs';

/**
 * A record held in one place (an issue or a file): { where, body, issue? | file? } or { error }.
 * An issue record can be edited by the CLI; a file record is in the repo and changes through a PR.
 */
export function readRecord(config, name) {
  let r;
  try {
    r = record(config, name);
  } catch (err) {
    return { error: err.message };
  }
  if (r.kind === 'file') {
    const file = join(config.root, r.path);
    if (!existsSync(file)) return { error: `${r.path} is missing` };
    return { where: r.path, file, body: readFileSync(file, 'utf8') };
  }
  if (r.kind !== 'github-issue') return { error: `records.${name}.kind "${r.kind}" isn't one issue or file` };
  const found = listOpenIssues(r.label, { body: true });
  if (found.length !== 1) return { error: `${found.length} open issues labelled \`${r.label}\` (want 1); run \`melon records --check\`` };
  return { where: `#${found[0].number}`, issue: found[0].number, body: found[0].body ?? '' };
}

/** The decision log, read for gate and merge: a record plus its open entries. */
export function readDecisionLog(config) {
  const r = readRecord(config, 'decisionLog');
  return r.error ? r : { ...r, entries: decisionEntries(r.body) };
}

const ATTEMPTS = 3;

/**
 * Rewrite a record from a fresh read. An issue body is replaced whole, so another writer's edit
 * can land between the read and the write: after writing, re-read, and retry when `check` says the
 * change didn't survive. `change(body)` returns { body, check(afterBody), ... } or { error }.
 * Returns the change's result plus { where, tries }, or { error }.
 */
export function updateRecord(config, name, change) {
  for (let tries = 1; tries <= ATTEMPTS; tries++) {
    const rec = readRecord(config, name);
    if (rec.error) return rec;
    const next = change(rec.body);
    if (next.error) return next;
    if (rec.file) {
      writeFileSync(rec.file, next.body);
      return { ...next, where: rec.where, file: true, tries };
    }
    editIssueBody(rec.issue, next.body);
    const after = readRecord(config, name);
    if (!after.error && next.check(after.body)) return { ...next, where: rec.where, tries };
  }
  return { error: `another writer kept replacing it (${ATTEMPTS} tries); run it again` };
}

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
