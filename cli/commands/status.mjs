// melon status: the live view, built from labels. Nobody maintains a status table by hand.
import { getPrFiles, listOpenIssues, listOpenPrs } from '../lib/github.mjs';
import { addsMigration, closedIssues, hotspotsHeld, tierFromLabels } from '../lib/rules.mjs';
import { ghJson } from '../lib/sh.mjs';

export const help = `melon status [--no-slots]
  In-flight PRs (tier, draft/ready, hotspots held, migration, stale), then issues by status
  label: ready, building, blocked, needs-owner, and open issues with no tier.
  --no-slots  skip the per-PR file reads (faster; no hotspot/migration columns)`;

const days = (iso) => (Date.now() - Date.parse(iso)) / 86_400_000;
const tierOf = (labels) => tierFromLabels(labels).tier ?? '?';

export function main(args, config) {
  const prs = listOpenPrs();
  const issues = listOpenIssues();
  const bodies = new Map(
    ghJson(['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,body']).map((p) => [p.number, p.body]),
  );
  const linked = new Set();

  console.log('## Pull requests');
  if (prs.length === 0) console.log('none open');
  for (const p of prs) {
    const closes = closedIssues(bodies.get(p.number));
    closes.forEach((n) => linked.add(n));
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
    const cl = closes.length ? ` → ${closes.map((n) => `#${n}`).join(' ')}` : '';
    console.log(`- #${p.number} ${p.title} [${tags.join(', ')}]${cl}`);
  }

  const groups = [
    ['Ready to start', (i) => i.labels.includes('status:ready')],
    ['Building (no PR yet)', (i) => i.labels.includes('status:building') && !linked.has(i.number)],
    ['Blocked', (i) => i.labels.includes('status:blocked')],
    ['Needs owner', (i) => i.labels.includes('needs-owner')],
    ['No tier yet', (i) => tierFromLabels(i.labels).count === 0 && !i.labels.some((l) => config.status.untieredLabels.includes(l))],
  ];
  for (const [title, pick] of groups) {
    const hits = issues.filter(pick);
    if (!hits.length) continue;
    console.log(`\n## ${title} (${hits.length})`);
    for (const i of hits.slice(0, 25)) {
      const area = i.labels.find((l) => l.startsWith('area:')) ?? '';
      console.log(`- #${i.number} ${i.title} [tier:${tierOf(i.labels)}${area ? `, ${area}` : ''}]`);
    }
    if (hits.length > 25) console.log(`- … ${hits.length - 25} more`);
  }
  return 0;
}
