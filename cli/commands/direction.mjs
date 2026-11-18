// melon direction place: put a work item into the direction record's order. The orchestrator and
// designers both place work, and the record is one issue body, so the script re-reads it after
// writing instead of trusting a hand edit not to drop someone else's line.
import { directionOrder, placeInDirection } from '../lib/records.mjs';
import { updateRecord } from './records.mjs';

export const help = `melon direction place <#n> --why "<why it sits here>" [--after <#m>]
  Adds "<k>. #n: <why>" to the direction record's order section (the heading that says "order",
  "## Why this order" in the template), after #m's item or last, and renumbers the list. melon
  status lists ready work in this order. Fails if #n is already placed.
  To move or remove an item, or to write the rest of the record, edit it by hand.`;

export function main(args, config) {
  const [sub, ref] = args.positional;
  const n = Number(/^#?(\d+)$/.exec(ref ?? '')?.[1]);
  const after = args.flags.after ? Number(/^#?(\d+)$/.exec(String(args.flags.after))?.[1]) : null;
  const why = args.flags.why;
  if (sub !== 'place' || !n || Number.isNaN(after) || typeof why !== 'string' || !why.trim()) {
    console.error(help);
    return 2;
  }
  const r = updateRecord(config, 'direction', (body) => {
    const placed = placeInDirection(body, n, { after, why });
    return placed.error ? placed : { ...placed, check: (afterBody) => directionOrder(afterBody).has(n) };
  });
  if (r.error) {
    console.error(`Not placed: ${r.error}`);
    return 1;
  }
  console.log(`#${n} placed in the direction record (${r.where}).`);
  return 0;
}
