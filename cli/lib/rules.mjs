// Pure gate logic: no git, no network. Every function here is unit-tested in cli/test.
import { matchesAny } from './glob.mjs';

export const TIERS = ['s', 'm', 'h'];
const rank = (t) => TIERS.indexOf(t);

/**
 * The lowest tier a change allows, with the reasons. H is for changes that would break something
 * systemic: a file on the `h` list, or an *edit* (any deleted or changed line) to an `hEdits`
 * file such as a numbered rules doc. M is for an `m` floor path, a held hotspot, or more code churn than
 * `sMaxChurn` (paths in `churnIgnore` such as docs and fixtures don't count). Anything else is S.
 * `files`: [{ path, additions, deletions }].
 */
export function requiredTier(files, tiers, { heldHotspots = [] } = {}) {
  const h = [];
  const m = [];
  for (const f of files) {
    if (matchesAny(f.path, tiers.h)) h.push(`${f.path} (systemic path)`);
    else if (matchesAny(f.path, tiers.hEdits) && (f.deletions ?? 0) > 0) h.push(`${f.path} (edits existing rules)`);
    else if (matchesAny(f.path, tiers.m)) m.push(`${f.path} (M path)`);
  }
  if (h.length) return { tier: 'h', reasons: h };
  const churn = codeChurn(files, tiers.churnIgnore);
  const max = tiers.sMaxChurn ?? Infinity;
  if (churn > max) m.push(`${churn} changed lines of code (S allows ${max})`);
  if (heldHotspots.length) m.push(`holds hotspot ${heldHotspots.join(', ')}`);
  return m.length ? { tier: 'm', reasons: m } : { tier: 's', reasons: [`${churn} changed lines of code, no M or H path`] };
}

/** Added + deleted lines, not counting paths in `ignore` (docs, fixtures, lockfiles). */
export function codeChurn(files, ignore = []) {
  return files.filter((f) => !matchesAny(f.path, ignore)).reduce((n, f) => n + (f.additions ?? 0) + (f.deletions ?? 0), 0);
}

/**
 * Files a reviewer must read in depth: the reasons for H, plus held hotspots. The rest of the PR
 * is skimmed. Returns [{ path, why, churn }].
 */
export function focusFiles(files, tiers, hotspots) {
  const out = [];
  for (const f of files) {
    const why = [];
    if (matchesAny(f.path, tiers.h)) why.push('systemic path');
    if (matchesAny(f.path, tiers.hEdits) && (f.deletions ?? 0) > 0) why.push('edits existing rules');
    const held = hotspotsHeld([f], hotspots);
    if (held.length) why.push(`hotspot ${held.join(', ')}`);
    if (why.length) out.push({ path: f.path, why: why.join('; '), churn: (f.additions ?? 0) + (f.deletions ?? 0) });
  }
  return out;
}

export function maxTier(a, b) {
  return rank(a) >= rank(b) ? a : b;
}

export function tierFromLabels(labels) {
  const found = labels.map((l) => /^tier:([smh])$/.exec(l)?.[1]).filter(Boolean);
  return { tier: found.length === 1 ? found[0] : null, count: found.length };
}

export function isBelow(labelled, required) {
  return rank(labelled) < rank(required);
}

/**
 * Hotspots a PR holds. A file holds its hotspot when it is modified, removed or renamed. New
 * files never do, and neither do append-only files whose diff deletes nothing.
 * `files`: [{ path, status, deletions }], GitHub's per-file statuses.
 */
export function hotspotsHeld(files, hotspots) {
  const held = new Set();
  for (const f of files) {
    if (f.status === 'added') continue;
    for (const h of hotspots) {
      if (!matchesAny(f.path, h.paths)) continue;
      if (matchesAny(f.path, h.appendOnly ?? []) && (f.deletions ?? 0) === 0) continue;
      held.add(h.name);
    }
  }
  return [...held].sort();
}

/** True when the PR adds a file under the migrations paths (a stored-format change). */
export function addsMigration(files, migrations) {
  return files.some((f) => f.status === 'added' && matchesAny(f.path, migrations?.paths ?? []));
}

/** A section counts when it appears as a heading (`## Impact`) or a bold label (`**State:**`). */
export function missingSections(body, sections) {
  return sections.filter((name) => {
    const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return !new RegExp(`^\\s*(#{1,6}\\s*${n}\\b|\\*\\*${n}:?\\*\\*)`, 'im').test(body ?? '');
  });
}

/** Added lines from a unified-diff patch that match the TODO pattern. */
export function todoViolations(file, pattern) {
  if (!file.patch) return [];
  const re = new RegExp(pattern);
  const out = [];
  let line = 0;
  for (const raw of file.patch.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(raw);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (raw.startsWith('+')) {
      if (re.test(raw.slice(1))) out.push({ path: file.path, line, text: raw.slice(1).trim() });
      line++;
    } else if (!raw.startsWith('-')) {
      line++;
    }
  }
  return out;
}

const VERDICT = /^REVIEW VERDICT:\s*(APPROVE|CHANGES)\s*@\s*([0-9a-f]{7,40})/m;
const CHECK = /^MELON CHECK:\s*(PASS|FAIL)\s*@\s*([0-9a-f]{7,40})(?:\s*\(([^)]*)\))?/m;

/** The latest comment matching `re`, parsed. Comments are in posting order. */
function latest(comments, re, map) {
  for (let i = comments.length - 1; i >= 0; i--) {
    const m = re.exec(comments[i].body ?? '');
    if (m) return { ...map(m), createdAt: comments[i].createdAt };
  }
  return null;
}

export const latestVerdict = (comments) =>
  latest(comments, VERDICT, (m) => ({ verdict: m[1], sha: m[2] }));

export const latestCheck = (comments) =>
  latest(comments, CHECK, (m) => ({ result: m[1], sha: m[2], mode: m[3] ?? '' }));

export const hasMarker = (comments, marker) =>
  comments.some((c) => new RegExp(`^${marker}\\b`, 'm').test(c.body ?? ''));

/** Issue numbers a PR body closes (`Closes #12`, `Fixes #3, #4`). */
export function closedIssues(body) {
  const out = new Set();
  for (const m of (body ?? '').matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b:?\s+((?:#\d+[\s,and]*)+)/gi)) {
    for (const n of m[1].matchAll(/#(\d+)/g)) out.add(Number(n[1]));
  }
  return [...out];
}

/** First sentence of the Impact section's first point: the daily-log summary. */
export function impactSummary(body, label = 'What changes and why it matters') {
  const text = (body ?? '').replace(/<!--[\s\S]*?-->/g, '');
  const n = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`\\*\\*${n}:?\\*\\*:?\\s*([\\s\\S]*?)(?:\\n\\s*\\n|\\n\\*\\*|\\n#|$)`, 'i').exec(text);
  const para = m?.[1]?.replace(/\s+/g, ' ').trim();
  if (!para) return null;
  const sentence = /^(.+?[.!?])(?:\s+[A-Z(`"]|$)/.exec(para)?.[1] ?? para;
  return sentence.length > 400 ? `${sentence.slice(0, 397)}...` : sentence;
}

/** `Ledger: (...)` line in a PR body, if the builder or orchestrator wrote one. */
export function ledgerLine(body) {
  return /^\s*\**Ledger:?\**:?\s*(.+)$/im.exec(body ?? '')?.[1]?.trim() ?? null;
}

/**
 * Checks to run for a set of changed paths. A check with `paths` runs only when one matches.
 * When every changed path is docs-only, only checks marked `docsOnly: true` run.
 */
export function selectChecks(checks, changed, { full = false, docsOnlyGlobs = [] } = {}) {
  if (full) return checks;
  if (changed.length === 0) return [];
  const docsOnly = docsOnlyGlobs.length > 0 && changed.every((p) => matchesAny(p, docsOnlyGlobs));
  return checks.filter((c) => {
    if (docsOnly) return c.docsOnly === true;
    return !c.paths || changed.some((p) => matchesAny(p, c.paths));
  });
}

// Built from a char code so the source has no literal control character (no-control-regex).
const ANSI_COLOUR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

/** Lines worth showing from a failing check's output: error-looking lines, else the tail. */
export function failureExcerpt(output, { max = 40, tail = 30 } = {}) {
  const lines = output.replace(ANSI_COLOUR, '').split('\n');
  const interesting = lines.filter((l) =>
    /(FAIL|✗|×|\bfailed\b|\berror\b|Error:|AssertionError|expected|TS\d{4}|ELIFECYCLE|✘)/i.test(l),
  );
  const pick = interesting.length ? interesting.slice(0, max) : lines.filter(Boolean).slice(-tail);
  return pick.join('\n');
}

/** `YYYY-MM-DD` for `date` in an IANA time zone. */
export function localDate(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Group small issues by their `area:*` label. Issues without one go under `(no area)`. */
export function groupByArea(issues) {
  const groups = new Map();
  for (const i of issues) {
    const area = i.labels.find((l) => l.startsWith('area:'))?.slice(5) ?? '(no area)';
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push(i);
  }
  return groups;
}

/** PRs an issue says introduced it: "Caused by: #12" (also "Regressed in", "Introduced in"). */
export function causedBy(body) {
  const out = new Set();
  for (const m of (body ?? '').matchAll(/^\s*[-*]?\s*\**(?:caused by|regressed in|introduced in)\**:?\**\s*(.+)$/gim)) {
    for (const n of m[1].matchAll(/#(\d+)/g)) out.add(Number(n[1]));
  }
  return [...out];
}

/**
 * Escaped defects per tier: of `merged` PRs ([{ number, labels }]), which ones a later issue
 * ([{ number, body }]) names in "Caused by". Returns { s|m|h|?: { merged, escaped: [{ pr, issues }] } }.
 */
export function escapeReport(merged, issues) {
  const causes = new Map();
  for (const i of issues) for (const p of causedBy(i.body)) causes.set(p, [...(causes.get(p) ?? []), i.number]);
  const out = {};
  for (const p of merged) {
    const tier = tierFromLabels(p.labels).tier ?? '?';
    const row = (out[tier] ??= { merged: 0, escaped: [] });
    row.merged++;
    if (causes.has(p.number)) row.escaped.push({ pr: p.number, issues: causes.get(p.number) });
  }
  return out;
}
