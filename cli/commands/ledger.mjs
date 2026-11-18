// melon ledger: what a PR actually cost, from session transcripts, not agents' estimates.
import { getPr } from '../lib/github.mjs';
import { collect, countBlocking, fmt, forPr, inputEquivalent, period, totalInputEq } from '../lib/ledger.mjs';
import { ghJson } from '../lib/sh.mjs';
import { closedIssues } from '../lib/rules.mjs';

export const help = `melon ledger <pr> [--line] [--projects <dir>]
melon ledger --since YYYY-MM-DD [--until YYYY-MM-DD] [--projects <dir>]
  Sums the token use of every transcript attributed to the PR's issues: subagents named
  "builder #<n>" / "reviewer #<n>" (any role word plus #n), and sessions on a branch starting
  "<n>-". Reports calls, peak context, raw input/cache/output tokens and an input-equivalent
  total (cache reads 0.1x, 5m cache writes 1.25x, 1h writes 2x), plus review rounds and blocking
  findings from the verdict comments.
  Only sessions run on this machine leave transcripts in ~/.claude/projects; run the ledger
  where the agents ran (cloud sessions keep their own).
  --line      print only the daily-log ledger text (melon merge uses this)
  --since     the period view: sessions started in the window, split into work attributed to
              issues and overhead (the orchestrator's own sessions, design and other chats with
              no issue), with both divided by the PRs merged in the window. Overhead is split by
              role: a top-level session that ran melon-concept or grilling is design, one that
              ran melon-mode is the orchestrator. Per-PR ledgers leave overhead out; this is
              where it shows.
  --projects  transcript root (default ~/.claude/projects)`;

export function ledgerFor(number, config, projectsDir) {
  const pr = getPr(number);
  const issues = new Set(closedIssues(pr.body));
  const branchIssue = /^(\d+)-/.exec(pr.headRefName)?.[1];
  if (branchIssue) issues.add(Number(branchIssue));
  const transcripts = forPr(collect(config.root, projectsDir), { issues: [...issues], branch: pr.headRefName });
  const byRole = new Map();
  for (const t of transcripts) {
    const r = byRole.get(t.role) ?? { agents: 0, calls: 0, input: 0, write5m: 0, write1h: 0, read: 0, output: 0, peak: 0 };
    r.agents++;
    for (const k of ['calls', 'input', 'write5m', 'write1h', 'read', 'output']) r[k] += t[k];
    r.peak = Math.max(r.peak, t.peak);
    byRole.set(t.role, r);
  }
  const verdicts = pr.comments.filter((c) => /^REVIEW VERDICT:\s*CHANGES/m.test(c.body ?? ''));
  const rounds = verdicts.length;
  const findings = verdicts.reduce((n, c) => n + countBlocking(c.body), 0);
  return { pr, issues: [...issues], transcripts, byRole, rounds, findings };
}

export function ledgerLine({ byRole, rounds, findings }) {
  const order = ['builder', 'reviewer', 'interrogate', 'design', 'audit', 'other', 'session'];
  const parts = [...byRole.keys()]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((role) => {
      const r = byRole.get(role);
      return `${role}${r.agents > 1 ? `×${r.agents}` : ''} ${fmt(inputEquivalent(r))}`;
    });
  const total = [...byRole.values()].reduce((n, r) => n + inputEquivalent(r), 0);
  const who = parts.length ? `${parts.join(' / ')} = ${fmt(total)} input-eq tokens` : 'no transcripts found';
  return `${who}, ${rounds} round${rounds === 1 ? '' : 's'}, ${findings} finding${findings === 1 ? '' : 's'}`;
}

function periodReport(args, config) {
  const since = args.flags.since;
  const until = args.flags.until ?? '9999-99-99';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || (args.flags.until && !/^\d{4}-\d{2}-\d{2}$/.test(until))) {
    console.log('--since and --until take YYYY-MM-DD');
    return 2;
  }
  const { attributed, overhead } = period(collect(config.root, args.flags.projects), { since, until });
  const merged = ghJson(['pr', 'list', '--state', 'merged', '--limit', '500', '--json', 'number,mergedAt']).filter((p) => {
    const d = (p.mergedAt ?? '').slice(0, 10);
    return d >= since && d <= until;
  }).length;
  const a = totalInputEq(attributed);
  const o = totalInputEq(overhead);
  const per = (n) => (merged ? fmt(Math.round(n / merged)) : '—');
  console.log(`Sessions started ${since}${args.flags.until ? ` to ${until}` : ''}: ${merged} PR(s) merged`);
  console.log(`  attributed to issues  ${fmt(a).padStart(7)} input-eq  (${attributed.length} transcripts)  per merged PR ${per(a)}`);
  console.log(`  overhead              ${fmt(o).padStart(7)} input-eq  (${overhead.length} transcripts)  per merged PR ${per(o)}`);
  const byRole = new Map();
  for (const t of overhead) byRole.set(t.role, [...(byRole.get(t.role) ?? []), t]);
  for (const [role, list] of [...byRole].sort((x, y) => totalInputEq(y[1]) - totalInputEq(x[1]))) {
    console.log(`    ${role.padEnd(18)} ${fmt(totalInputEq(list)).padStart(7)} input-eq  (${list.length} transcripts)`);
  }
  console.log(`  overhead share        ${a + o ? Math.round((100 * o) / (a + o)) : 0}%`);
  return 0;
}

export function main(args, config) {
  if (args.flags.since) return periodReport(args, config);
  const number = args.positional[0];
  if (!number) {
    console.log(help);
    return 2;
  }
  const l = ledgerFor(number, config, args.flags.projects);
  if (args.flags.line) {
    console.log(ledgerLine(l));
    return 0;
  }
  console.log(`#${number} (issues ${l.issues.map((i) => `#${i}`).join(', ') || 'none'}): ${l.transcripts.length} transcript(s)`);
  console.log('role       agents  calls  peak ctx  input  cache-write  cache-read  output  input-eq');
  for (const [role, r] of l.byRole) {
    console.log(
      [role.padEnd(10), String(r.agents).padStart(6), String(r.calls).padStart(6), fmt(r.peak).padStart(9), fmt(r.input).padStart(6), fmt(r.write5m + r.write1h).padStart(12), fmt(r.read).padStart(11), fmt(r.output).padStart(7), fmt(inputEquivalent(r)).padStart(9)].join(' '),
    );
  }
  console.log(`\nLedger: ${ledgerLine(l)}`);
  return 0;
}
