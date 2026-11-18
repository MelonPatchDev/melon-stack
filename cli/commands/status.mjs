// melon status: the live board, built from the tracker. Nobody maintains a status table by hand.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPrFiles, listOpenIssues, listOpenPrs } from '../lib/github.mjs';
import { directionOrder, readiness, record, recordLabels } from '../lib/records.mjs';
import { addsMigration, closedIssues, hotspotsHeld, labelLine, tierFromLabels } from '../lib/rules.mjs';
import { ghJson } from '../lib/sh.mjs';

export const help = `melon status [--no-slots]
  In-flight PRs (tier, draft/ready, hotspots held, migration, stale), then work items:
  ready to start (every "Depends on: #n" closed), waiting on dependencies, building, blocked,
  needs-owner, and open issues with no tier. Each ready item shows what it unlocks.
  Ready items are listed in the order the direction record first mentions them; ready items it
  doesn't mention yet are listed apart, for the orchestrator to place.
  Record issues (decision log, owner list, direction, daily log) are left out.
  --no-slots  skip the per-PR file reads (faster; no hotspot/migration tags)`;

const days = (iso) => (Date.now() - Date.parse(iso)) / 86_400_000;
const tierOf = (labels) => tierFromLabels(labels).tier ?? '?';
const refs = (ns) => ns.map((n) => `#${n}`).join(' ');

/** The direction record's body, or null when it can't be read (so no order is applied). */
function directionBody(config, openIssues) {
  let r;
  try {
    r = record(config, 'direction');
  } catch {
    return null;
  }
  if (r.kind === 'github-issue') {
    const found = openIssues.filter((i) => i.labels.includes(r.label));
    return found.length === 1 ? (found[0].body ?? '') : null;
  }
  if (r.kind === 'file') {
    const file = join(config.root, r.path);
    return existsSync(file) ? readFileSync(file, 'utf8') : null;
  }
  return null;
}

export function main(args, config) {
  const prs = listOpenPrs();
  const skip = new Set([...recordLabels(config), ...config.status.untieredLabels]);
  const allIssues = listOpenIssues(undefined, { body: true });
  const issues = allIssues.filter((i) => !i.labels.some((l) => skip.has(l)));
  const direction = directionBody(config, allIssues);
  const bodies = new Map(
    ghJson(['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,body']).map((p) => [p.number, p.body]),
  );
  const inPr = new Set();

  console.log('## Pull requests');
  if (prs.length === 0) console.log('none open');
  for (const p of prs) {
    const closes = closedIssues(bodies.get(p.number));
    closes.forEach((n) => inPr.add(n));
    const tags = [`tier:${tierOf(p.labels)}`, p.isDraft ? 'draft' : 'ready'];
    if (p.labels.includes('parked')) tags.push('parked');
    if (p.labels.includes('needs-owner')) tags.push('needs-owner');
    if (!p.labels.includes('parked') && days(p.updatedAt) > config.staleDays) tags.push(`stale ${Math.floor(days(p.updatedAt))}d`);
    if (!args.flags['no-slots'] && !p.labels.includes('parked')) {
      const files = getPrFiles(p.number);
      const held = hotspotsHeld(files, config.hotspots);
      if (held.length) tags.push(`holds ${held.join('+')}`);
      if (addsMigration(files, config.migrations)) tags.push('MIGRATION');
    }
    console.log(`- #${p.number} ${p.title} [${tags.join(', ')}]${closes.length ? ` → ${refs(closes)}` : ''}`);
    const system = labelLine(bodies.get(p.number), 'System');
    if (system) console.log(`    system: ${system.length > 140 ? `${system.slice(0, 137)}...` : system}`);
  }

  const { ready, waiting, unlocks } = readiness(issues);
  const line = (i, extra = '') => {
    const area = i.labels.find((l) => l.startsWith('area:'));
    const opens = unlocks.get(i.number);
    return `- #${i.number} ${i.title} [tier:${tierOf(i.labels)}${area ? `, ${area}` : ''}]${extra}${opens?.length ? ` · unlocks ${refs(opens)}` : ''}`;
  };
  const isReadyLabel = (i) => i.labels.includes('status:ready') && !inPr.has(i.number);
  const readyNow = ready.filter(isReadyLabel);
  const order = direction === null ? null : directionOrder(direction);
  const readyGroups = order
    ? [
        ['Ready to start (dependencies closed), in direction order', readyNow.filter((i) => order.has(i.number)).sort((a, b) => order.get(a.number) - order.get(b.number)).map((i) => line(i))],
        ['Ready, not in direction yet (place each, or say why it waits)', readyNow.filter((i) => !order.has(i.number)).map((i) => line(i))],
      ]
    : [['Ready to start (dependencies closed; direction record not found, so unordered)', readyNow.map((i) => line(i))]];
  const groups = [
    ...readyGroups,
    ['Waiting on dependencies', waiting.filter(({ issue }) => !inPr.has(issue.number)).map(({ issue, on }) => line(issue, ` · waits on ${refs(on)}`))],
    ['Building (no PR yet)', issues.filter((i) => i.labels.includes('status:building') && !inPr.has(i.number)).map((i) => line(i))],
    ['Blocked', issues.filter((i) => i.labels.includes('status:blocked')).map((i) => line(i))],
    ['Needs owner', issues.filter((i) => i.labels.includes('needs-owner')).map((i) => line(i))],
    ['No tier yet', issues.filter((i) => tierFromLabels(i.labels).count === 0).map((i) => line(i))],
  ];
  for (const [title, rows] of groups) {
    if (!rows.length) continue;
    console.log(`\n## ${title} (${rows.length})`);
    rows.slice(0, 25).forEach((r) => console.log(r));
    if (rows.length > 25) console.log(`- … ${rows.length - 25} more`);
  }
  return 0;
}
