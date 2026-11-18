// Records: the forward-looking artifacts the process runs on, named by role. Skills say "the
// decision log"; each repo's melon.config.json says where that lives. The code and its tests are
// the documentation of what's built, so records hold only what is open or in flight.

/** Every record, its purpose, and the default location (GitHub). */
export const RECORDS = {
  workItems: { purpose: 'issues: brief, tier, dependencies, design discussion', default: { kind: 'github-issues' } },
  decisionLog: {
    purpose: 'open decisions for unfinished work; each graduates into a test, type, rule or reference doc, then leaves the log',
    default: { kind: 'github-issue', label: 'decisions', title: 'Decision log' },
  },
  ownerList: {
    purpose: "what waits on the owner: Needs you / Review later / Coming up / Done",
    default: { kind: 'github-issue', label: 'owner-attention', title: 'Owner attention' },
  },
  direction: {
    purpose: 'the order of upcoming work and why, in the body; orchestrator hand-offs as comments',
    default: { kind: 'github-issue', label: 'direction', title: 'Direction' },
  },
  dailyLog: {
    purpose: 'one line per merge, with the measured ledger',
    default: { kind: 'github-issue', label: 'daily-log', titlePrefix: 'Daily log ', per: 'day' },
  },
};

/** Kinds the CLI can read and write today. Others are valid config but fail when used. */
export const SUPPORTED = new Set(['github-issues', 'github-issue', 'file']);

export function resolveRecords(config) {
  const out = {};
  for (const [name, def] of Object.entries(RECORDS)) out[name] = { ...def.default, ...(config.records?.[name] ?? {}) };
  return out;
}

/** The record's location, or a clear error when its kind has no CLI support yet. */
export function record(config, name) {
  const r = resolveRecords(config)[name];
  if (!r) throw new Error(`Unknown record "${name}". Records: ${Object.keys(RECORDS).join(', ')}`);
  if (!SUPPORTED.has(r.kind)) {
    throw new Error(`records.${name}.kind "${r.kind}" isn't supported by the melon CLI yet (supported: ${[...SUPPORTED].join(', ')}).`);
  }
  return r;
}

/** Labels that mark record issues, so status never lists them as untiered work. */
export function recordLabels(config) {
  return Object.values(resolveRecords(config))
    .map((r) => r.label)
    .filter(Boolean);
}

/** "Depends on: #12, #14" (or "Blocked by") lines in an issue body or brief. */
export function dependencies(body) {
  const out = new Set();
  for (const m of (body ?? '').matchAll(/^\s*[-*]?\s*\**(?:(?:depends on|blocked by)\**:?|after\**:)\**\s*(.+)$/gim)) {
    for (const n of m[1].matchAll(/#(\d+)/g)) out.add(Number(n[1]));
  }
  return [...out];
}

/**
 * Readiness of work items: an issue is ready when every dependency is closed (not in the open
 * set). Returns { ready: [...], waiting: [{ issue, on: [n...] }], unlocks: Map(n -> [n...]) }.
 */
export function readiness(openIssues) {
  const open = new Set(openIssues.map((i) => i.number));
  const ready = [];
  const waiting = [];
  const unlocks = new Map();
  for (const i of openIssues) {
    const deps = dependencies(i.body);
    for (const d of deps) {
      if (!unlocks.has(d)) unlocks.set(d, []);
      unlocks.get(d).push(i.number);
    }
    const on = deps.filter((d) => open.has(d));
    if (on.length) waiting.push({ issue: i, on });
    else ready.push(i);
  }
  return { ready, waiting, unlocks };
}

// Decisions graduate: an open decision-log entry leaves the log when the PR that implements it
// names where it now lives ("D3 → src/money.test.ts:42"). The gate checks the target exists.

const stripComments = (s) => (s ?? '').replace(/<!--[\s\S]*?-->/g, '');

/** Open decision-log entries: table rows starting `| D<n> |`; `for` is the work items in the last cell. */
export function decisionEntries(logBody) {
  const out = [];
  for (const m of stripComments(logBody).matchAll(/^\|\s*(D\d+)\s*\|(.*)\|\s*$/gm)) {
    const cells = m[2].split('|');
    out.push({ id: m[1], for: [...cells[cells.length - 1].matchAll(/#(\d+)/g)].map((n) => Number(n[1])) });
  }
  return out;
}

/** The log body without the rows for `ids`. */
export function removeEntries(logBody, ids) {
  const drop = new Set(ids);
  return (logBody ?? '')
    .split('\n')
    .filter((l) => !drop.has(/^\|\s*(D\d+)\s*\|/.exec(l)?.[1]))
    .join('\n');
}

// Any role may add a decision, so numbering and appending are scripted (`melon decision add`):
// two agents picking the same D<n> by hand would attach graduations to the wrong entry.
const NEXT_MARK = /<!--\s*melon:next-decision\s+D(\d+)\s*-->/;

/** The next free id: past every open entry and past the high-water mark, so ids never repeat after graduation. */
export function nextDecisionId(logBody) {
  const open = decisionEntries(logBody).map((e) => Number(e.id.slice(1)));
  const mark = Number(NEXT_MARK.exec(logBody ?? '')?.[1] ?? 0);
  return `D${Math.max(mark, ...open.map((n) => n + 1), 1)}`;
}

/** One table cell: no pipes or line breaks, which would break the row. */
const cell = (s) => String(s ?? '').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '/').trim();

/**
 * The log body with a new row after the last table row (or a new table), and the high-water mark
 * moved past it. Returns { body, id }.
 */
export function addDecision(logBody, { decision, basis, argued, graduates, forItems }) {
  const id = nextDecisionId(logBody);
  const row = `| ${id} | ${[decision, basis, argued, graduates].map(cell).join(' | ')} | ${forItems.map((n) => `#${n}`).join(', ')} |`;
  const mark = `<!-- melon:next-decision D${Number(id.slice(1)) + 1} -->`;
  const lines = (logBody ?? '').replace(NEXT_MARK, '').replace(/\s+$/, '').split('\n');
  let last = -1;
  lines.forEach((l, i) => {
    if (/^\|.*\|\s*$/.test(l)) last = i;
  });
  if (last === -1) lines.push('', '| # | Decision | Basis | Argued in | Graduates to | For |', '|---|---|---|---|---|---|', row);
  else lines.splice(last + 1, 0, row);
  return { id, body: `${lines.join('\n').replace(/^\n+/, '')}\n\n${mark}\n` };
}

// The direction record's order lives in one section, the one whose heading says "order" ("## Why
// this order"). Mentions elsewhere ("if #45 slips…") don't place an item. A record without that
// section is read whole.
const ORDER_HEADING = /^(#{1,6})\s.*\border\b/i;
const ORDER_ITEM = /^\d+\.\s/;

/** Line indexes [start, end) of the order section's body, or null. */
function orderSection(lines) {
  const start = lines.findIndex((l) => ORDER_HEADING.test(l));
  if (start === -1) return null;
  const level = ORDER_HEADING.exec(lines[start])[1].length;
  let end = start + 1;
  while (end < lines.length && !(/^(#{1,6})\s/.exec(lines[end])?.[1].length <= level)) end++;
  return [start + 1, end];
}

/**
 * Where each work item first appears in the direction record's order: Map(n → position). An item
 * it never mentions hasn't been placed yet.
 */
export function directionOrder(body) {
  const lines = stripComments(body).split('\n');
  const [from, to] = orderSection(lines) ?? [0, lines.length];
  const order = new Map();
  for (const m of lines.slice(from, to).join('\n').matchAll(/#(\d+)/g)) {
    const n = Number(m[1]);
    if (!order.has(n)) order.set(n, order.size);
  }
  return order;
}

/**
 * The direction body with "<k>. #n: <why>" in its order section: after the item that mentions
 * #after, or last. Numbered items are renumbered. Returns { body } or { error }.
 */
export function placeInDirection(body, n, { after, why }) {
  if (directionOrder(body).has(n)) return { error: `#${n} is already in the direction order` };
  const lines = (body ?? '').replace(/\s+$/, '').split('\n');
  const section = orderSection(lines);
  const item = `1. #${n}: ${cell(why)}`;
  if (!section) return { body: `${lines.join('\n')}\n\n## Why this order\n${item}\n` };
  const [from, to] = section;
  const items = [];
  for (let i = from; i < to; i++) if (ORDER_ITEM.test(lines[i])) items.push(i);
  let at = items.length ? items[items.length - 1] + 1 : from;
  if (after) {
    const ref = items.find((i) => new RegExp(`#${after}\\b`).test(lines[i]));
    if (ref === undefined) return { error: `#${after} isn't in the direction order` };
    at = ref + 1;
    while (at < to && /^\s+\S/.test(lines[at])) at++; // keep the item's own indented lines with it
  }
  lines.splice(at, 0, item);
  let k = 0;
  for (let i = from; i <= to; i++) if (ORDER_ITEM.test(lines[i] ?? '')) lines[i] = lines[i].replace(/^\d+\./, `${++k}.`);
  return { body: `${lines.join('\n')}\n` };
}

/** `D<n> → <where>` (or `->`) lines in a PR body: Map(id → target text). */
export function graduations(body) {
  const out = new Map();
  for (const m of stripComments(body).matchAll(/^\s*[-*]?\s*`?(D\d+)`?\s*(?:→|->)\s*(.*)$/gm)) out.set(m[1], m[2].trim());
  return out;
}

/**
 * The repo file (and line, or test name after "›") a graduation names, or null when it names none ("nothing: the code
 * makes it obvious", "ground rule 4"). A file is a token with a slash, or name.ext with a name of
 * two or more characters (so "e.g." isn't one).
 */
export function graduationTarget(text) {
  const named = /^(.*?)\s+(?:›|>)\s+["'`]?(.+?)["'`]?\s*$/.exec(text ?? '');
  if (named) {
    const t = graduationTarget(named[1]);
    if (t) return { ...t, name: named[2] };
  }
  for (const raw of (text ?? '').replace(/`/g, ' ').split(/\s+/)) {
    const tok = raw.replace(/^[([{"']+|[)\]},;"'.]+$/g, '');
    const m = /^([\w@.\-/]+?)(?::(\d+)(?:-\d+)?)?$/.exec(tok);
    if (!m) continue;
    const path = m[1].replace(/^\.\//, '');
    const base = path.split('/').pop();
    const ext = /^(.+)\.([A-Za-z][\w]{0,5})$/.exec(base);
    if (path.includes('/') ? base.length > 0 : ext && ext[1].length >= 2) return { path, line: m[2] ? Number(m[2]) : null };
  }
  return null;
}
