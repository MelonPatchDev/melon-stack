// melon escapes: the quality half of the ledger. The ledger says what a PR cost; this says how
// often PRs of each tier let a defect through, so cheaper review is a measured bet.
import { causedBy, escapeReport, localDate } from '../lib/rules.mjs';
import { ghJson } from '../lib/sh.mjs';

export const help = `melon escapes [--since YYYY-MM-DD] [--json]
  Of the PRs merged since the date (default: 30 days ago), how many later needed a fix: an issue
  (open or closed) with a "Caused by: #<pr>" line naming them. Grouped by the PR's tier.
  Builders add the line when a bug traces to a merged PR; reverts open one too.
  If a tier's escape rate climbs, its review is too thin for the risk: raise the tier floor or
  the reviewer's model, and record it in the direction record.`;

const labelNames = (labels) => (labels ?? []).map((l) => l.name);

export function main(args, config) {
  const since = args.flags.since ?? localDate(new Date(Date.now() - 30 * 86_400_000), config.timeZone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    console.log('--since takes YYYY-MM-DD');
    return 2;
  }
  const merged = ghJson(['pr', 'list', '--state', 'merged', '--limit', '500', '--json', 'number,labels,mergedAt'])
    .filter((p) => (p.mergedAt ?? '').slice(0, 10) >= since)
    .map((p) => ({ ...p, labels: labelNames(p.labels) }));
  const issues = ghJson(['issue', 'list', '--state', 'all', '--limit', '500', '--search', '"Caused by" in:body', '--json', 'number,body'])
    .filter((i) => causedBy(i.body).length);
  const report = escapeReport(merged, issues);

  if (args.flags.json) {
    console.log(JSON.stringify({ since, tiers: report }, null, 2));
    return 0;
  }
  console.log(`Escaped defects for PRs merged since ${since}`);
  console.log('| Tier | Merged | Escaped | Rate | PR → fixing issues |');
  console.log('|---|---|---|---|---|');
  for (const tier of ['s', 'm', 'h', '?']) {
    const r = report[tier];
    if (!r) continue;
    const rate = `${Math.round((100 * r.escaped.length) / r.merged)}%`;
    const list = r.escaped.map((e) => `#${e.pr} → ${e.issues.map((n) => `#${n}`).join(' ')}`).join('; ');
    console.log(`| ${tier} | ${r.merged} | ${r.escaped.length} | ${rate} | ${list || '—'} |`);
  }
  if (!Object.keys(report).length) console.log('| — | 0 | 0 | — | — |');
  return 0;
}
