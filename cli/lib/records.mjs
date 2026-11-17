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
  for (const m of (body ?? '').matchAll(/^\s*[-*]?\s*\**(?:depends on|blocked by|after)\**:?\**\s*(.+)$/gim)) {
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
