// melon escapes: the quality half of the ledger. The ledger says what a PR cost; this says how
// often PRs of each tier let a defect through, so cheaper review is a measured bet.
import { collect, fmt, forPr, totalInputEq } from '../lib/ledger.mjs';
import { causedBy, closedIssues, escapeReport, localDate } from '../lib/rules.mjs';
import { ghJson } from '../lib/sh.mjs';

export const help = `melon escapes [--since YYYY-MM-DD] [--settle <days>] [--cost] [--json]
  Of the PRs merged since the date (default: 60 days ago) and at least --settle days ago
  (default 14, so a PR has had time to show its bugs), how many later needed a fix: an issue
  (open or closed) with a "Caused by: #<pr>" line naming them. Grouped by the PR's tier.
  Builders add the line when a bug traces to a merged PR; the orchestrator adds it to bugs the
  owner files; reverts open one too.
  --cost   also the median measured cost per PR in each tier, from this machine's transcripts,
           so cost and escapes read side by side
  If a tier's escape rate climbs, its review is too thin for the risk: raise the tier floor for
  that area, or run interrogate on its recent merges, and record it in the direction record.`;

const labelNames = (labels) => (labels ?? []).map((l) => l.name);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function main(args, config) {
  const since = args.flags.since ?? localDate(new Date(Date.now() - 60 * 86_400_000), config.timeZone);
  const settle = Number(args.flags.settle ?? 14);
  if (!DATE.test(since) || !Number.isInteger(settle) || settle < 0) {
    console.log('--since takes YYYY-MM-DD; --settle takes a whole number of days');
    return 2;
  }
  const until = localDate(new Date(Date.now() - settle * 86_400_000), config.timeZone);
  const merged = ghJson(['pr', 'list', '--state', 'merged', '--limit', '500', '--json', 'number,labels,mergedAt,body,headRefName'])
    .filter((p) => {
      const d = (p.mergedAt ?? '').slice(0, 10);
      return d >= since && d <= until;
    })
    .map((p) => ({ ...p, labels: labelNames(p.labels) }));
  const issues = ghJson(['issue', 'list', '--state', 'all', '--limit', '500', '--search', '"Caused by" in:body', '--json', 'number,body'])
    .filter((i) => causedBy(i.body).length);
  const report = escapeReport(merged, issues);

  if (args.flags.cost) {
    const transcripts = collect(config.root, args.flags.projects);
    const byTier = {};
    for (const p of merged) {
      const tier = Object.keys(report).find((t) => t !== '?' && p.labels.includes(`tier:${t}`)) ?? '?';
      const list = forPr(transcripts, { issues: closedIssues(p.body), branch: p.headRefName });
      if (list.length) (byTier[tier] ??= []).push(totalInputEq(list));
    }
    for (const [tier, r] of Object.entries(report)) {
      r.medianCost = median(byTier[tier] ?? []);
      r.measured = (byTier[tier] ?? []).length;
    }
  }

  if (args.flags.json) {
    console.log(JSON.stringify({ since, until, tiers: report }, null, 2));
    return 0;
  }
  const cost = Boolean(args.flags.cost);
  console.log(`Escaped defects for PRs merged ${since} to ${until} (settled ${settle} days)`);
  console.log(`| Tier | Merged | Escaped | Rate |${cost ? ' Median cost (measured) |' : ''} PR → fixing issues |`);
  console.log(`|---|---|---|---|${cost ? '---|' : ''}---|`);
  for (const tier of ['s', 'm', 'h', '?']) {
    const r = report[tier];
    if (!r) continue;
    const rate = `${Math.round((100 * r.escaped.length) / r.merged)}%`;
    const list = r.escaped.map((e) => `#${e.pr} → ${e.issues.map((n) => `#${n}`).join(' ')}`).join('; ');
    const c = cost ? ` ${r.medianCost === null ? '—' : fmt(r.medianCost)} (${r.measured}/${r.merged}) |` : '';
    console.log(`| ${tier} | ${r.merged} | ${r.escaped.length} | ${rate} |${c} ${list || '—'} |`);
  }
  if (!Object.keys(report).length) console.log(`| — | 0 | 0 | — |${cost ? ' — |' : ''} — |`);
  if (Object.values(report).some((r) => r.merged < 5)) console.log('Fewer than 5 PRs in a tier: read the counts, not the rate.');
  return 0;
}
