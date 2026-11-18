// melon batch: group small open issues by area into maintenance issues, so one builder session
// (one onboarding cost) fixes several of them.
import { listOpenIssues } from '../lib/github.mjs';
import { groupByArea, tierFromLabels } from '../lib/rules.mjs';
import { gh } from '../lib/sh.mjs';

export const help = `melon batch [--area <name>] [--min <n>] [--create]
  Lists open issues labelled with any of batch.labels (default found-by-agent, bug) that are
  tier:s or untiered and not yet batched, grouped by area:* label. Groups with at least
  --min (default batch.minIssues) issues are ready to batch.
  --create  open one maintenance issue per ready group (or just --area), label it tier:s and
            the area, and mark its members "batched"`;

export function main(args, config) {
  const min = Number(args.flags.min ?? config.batch.minIssues);
  const seen = new Map();
  for (const label of config.batch.labels) for (const i of listOpenIssues(label)) seen.set(i.number, i);
  const candidates = [...seen.values()].filter(
    (i) => !i.labels.includes('batched') && !i.labels.includes('parked') && ['s', null].includes(tierFromLabels(i.labels).tier),
  );
  const groups = groupByArea(candidates);
  if (groups.size === 0) {
    console.log('No unbatched small issues.');
    return 0;
  }

  for (const [area, list] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    if (args.flags.area && args.flags.area !== area) continue;
    const ready = list.length >= min && area !== '(no area)';
    console.log(`${ready ? '●' : '○'} ${area}: ${list.map((i) => `#${i.number}`).join(' ')}${ready ? '' : `  (${area === '(no area)' ? 'label an area first' : `needs ${min}`})`}`);
    if (!ready || !args.flags.create) continue;

    const nums = list.map((i) => `#${i.number}`).join(', ');
    const body = [
      `Batch of small fixes in **${area}**, for one builder session. Each fix keeps its own commit; one PR closes all of them.`,
      '',
      ...list.map((i) => `- [ ] #${i.number} ${i.title}`),
      '',
      '## Brief',
      'Goal: fix each item at its root cause, with a test that would have caught it.',
      `Done check: \`melon check\` passes; each item above has a test or a stated reason it can't.`,
      'Owned paths: the files each item names. Anything else goes back to the orchestrator.',
      '',
      `Closes on merge: ${nums}`,
    ].join('\n');
    const url = gh(['issue', 'create', '--title', `Maintenance: ${area} (${nums})`, '--label', `tier:s,area:${area},maintenance,status:ready`, '--body', body]);
    const batchNo = url.split('/').pop();
    for (const i of list) {
      gh(['issue', 'edit', String(i.number), '--add-label', 'batched']);
      gh(['issue', 'comment', String(i.number), '--body', `Batched into #${batchNo}.\n\n${config.signature}`]);
    }
    console.log(`  → created ${url}`);
  }
  return 0;
}
