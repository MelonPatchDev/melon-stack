// melon labels: the label set the process runs on.
import { resolveRecords } from '../lib/records.mjs';
import { gh, ghJson } from '../lib/sh.mjs';

export const help = `melon labels [--apply]
  Lists the labels melon-stack uses and which are missing. --apply creates the missing ones
  and leaves existing labels untouched (areas come from "areas" in melon.config.json).`;

export function labelSet(config) {
  return [
    ['tier:s', '0e8a16', 'Small/mechanical: scripted gate, no reviewer, no PR CI'],
    ['tier:m', 'fbca04', 'Default: test plan before code, one review pass, CI once'],
    ['tier:h', 'b60205', 'Systemic risk: design check, focus-file review, golden tests'],
    ['status:ready', 'c5def5', 'Brief written; can start'],
    ['status:building', '1d76db', 'A builder is on it'],
    ['status:blocked', '5319e7', 'Waiting on another issue or an outside source'],
    ['parked', 'bfdadc', 'Experimental or side work; tooling and the orchestrator skip it'],
    ['needs-owner', 'd93f0b', 'Waits for an owner-only action'],
    ['owner-review', 'f9d0c4', 'Merged, but the owner should review the decision later'],
    ['found-by-agent', 'ededed', 'Found outside an agent lane'],
    ['bug', 'd73a4a', 'Something is wrong'],
    ['batched', 'ededed', 'Folded into a maintenance issue'],
    ['maintenance', 'c2e0c6', 'A batch of small fixes'],
    ...Object.entries(resolveRecords(config))
      .filter(([, r]) => r.kind === 'github-issue' && r.label)
      .map(([name, r]) => [r.label, '0052cc', `Record: ${name}`]),
    ...config.areas.map((a) => [`area:${a}`, 'bfd4f2', `Area: ${a}`]),
  ];
}

export function main(args, config) {
  const have = new Set(ghJson(['label', 'list', '--limit', '300', '--json', 'name']).map((l) => l.name));
  const want = labelSet(config);
  const missing = want.filter(([n]) => !have.has(n));
  if (!args.flags.apply) {
    console.log(missing.length ? `Missing (${missing.length}): ${missing.map(([n]) => n).join(', ')}\nRun with --apply to create them.` : 'All labels present.');
    return 0;
  }
  // Only missing labels are created; existing ones keep their colour and description.
  for (const [name, color, description] of missing) {
    gh(['label', 'create', name, '--color', color, '--description', description]);
  }
  console.log(`Created ${missing.length} label(s); ${want.length - missing.length} already existed.`);
  return 0;
}
