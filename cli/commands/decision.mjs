// melon decision add: append an open decision to the decision log. Any role may record one; the
// script numbers it and re-reads the log after writing, so two writers can't share an id or
// silently drop each other's row.
import { addDecision, decisionEntries } from '../lib/records.mjs';
import { updateRecord } from './records.mjs';

export const help = `melon decision add --for <#n[,#m]> --text "<decision>" [--basis "..."] [--argued "#n"] [--graduates "..."]
  Appends a row to the decision log with the next free D<n>, and prints the id.
  --for        the work item(s) it's for; melon gate holds a PR that closes one until it names
               where the decision graduated ("D<n> → <where>")
  --text       one line: what was decided
  --basis      ground rule / persona / criterion / precedent / taste call
  --argued     the issue or PR where it was argued
  --graduates  where it will live once built: a test, type, lint, ground rule or reference doc
  An issue log is re-read after the write and retried if another writer's edit replaced it. A
  file log is edited in the working tree and lands through your PR.`;

export function main(args, config) {
  const [sub] = args.positional;
  const { for: forFlag, text, basis = '', argued = '', graduates = '' } = args.flags;
  const forItems = [...String(forFlag ?? '').matchAll(/\d+/g)].map((m) => Number(m[0]));
  if (sub !== 'add' || !forItems.length || typeof text !== 'string' || !text.trim()) {
    console.error(help);
    return 2;
  }
  const r = updateRecord(config, 'decisionLog', (body) => {
    const { id, body: next } = addDecision(body, { decision: text, basis, argued, graduates, forItems });
    const check = (after) => {
      const mine = decisionEntries(after).filter((e) => e.id === id);
      return mine.length === 1 && mine[0].for.join() === forItems.join();
    };
    return { id, body: next, check };
  });
  if (r.error) {
    console.error(`Decision not added: ${r.error}`);
    return 1;
  }
  console.log(`${r.id} added to the decision log (${r.where})${r.file ? '. Commit it with your PR.' : '.'}`);
  return 0;
}
