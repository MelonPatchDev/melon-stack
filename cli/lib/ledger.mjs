// Real token use from Claude Code session transcripts (~/.claude/projects). Each API call's usage
// is logged on the assistant entries; one call can appear on several entries (one per content
// block), so calls are de-duplicated by message id.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Input-equivalent weights (Anthropic API list pricing relative to base input): cache reads cost
// 0.1x, 5-minute cache writes 1.25x, 1-hour cache writes 2x. Subscription usage limits may weight
// differently; the raw counts are reported alongside.
export const WEIGHTS = { input: 1, write5m: 1.25, write1h: 2, read: 0.1 };

/** Claude Code's project directory name for a path: every "/" and "." becomes "-". */
export const encodeProjectDir = (path) => path.replace(/[/.]/g, '-');

// Skills a session ran, by Skill tool call or typed slash command ("/melon-stack:melon-concept").
const SKILL_USE = /"name":"Skill","input":\{"skill":"(?:[\w-]+:)?([\w-]+)"|<command-name>\/(?:[\w-]+:)?([\w-]+)<\/command-name>/g;

const COUNTS = ['calls', 'input', 'write5m', 'write1h', 'read', 'output'];
const zero = () => ({ calls: 0, input: 0, write5m: 0, write1h: 0, read: 0, output: 0, peak: 0 });

/**
 * Totals for one transcript, plus the same totals per git branch (`byBranch`): a long session
 * that visits a PR's branch is charged to it only for the calls it made there. `ctx` is the
 * context size at the latest call.
 */
export function summarize(text) {
  const seen = new Set();
  const s = { ...zero(), ctx: 0, byBranch: new Map(), branches: new Set(), models: new Set(), skills: new Set(), first: null, last: null };
  for (const line of text.split('\n')) {
    if (line.includes('Skill') || line.includes('command-name')) for (const m of line.matchAll(SKILL_USE)) s.skills.add(m[1] ?? m[2]);
    if (!line.includes('"usage"')) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const u = o.message?.usage;
    const id = o.message?.id ?? o.requestId;
    if (o.type !== 'assistant' || !u || seen.has(id)) continue;
    seen.add(id);
    const write = u.cache_creation_input_tokens ?? 0;
    const w1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
    const ctx = (u.input_tokens ?? 0) + write + (u.cache_read_input_tokens ?? 0);
    const branch = o.gitBranch ?? '';
    if (!s.byBranch.has(branch)) s.byBranch.set(branch, zero());
    for (const t of [s, s.byBranch.get(branch)]) {
      t.calls++;
      t.input += u.input_tokens ?? 0;
      t.write1h += w1h;
      t.write5m += write - w1h;
      t.read += u.cache_read_input_tokens ?? 0;
      t.output += u.output_tokens ?? 0;
      t.peak = Math.max(t.peak, ctx);
    }
    s.ctx = ctx;
    if (o.gitBranch) s.branches.add(o.gitBranch);
    if (o.message?.model) s.models.add(o.message.model);
    s.first ??= o.timestamp;
    s.last = o.timestamp ?? s.last;
  }
  return s;
}

export const inputEquivalent = (s) =>
  Math.round(s.input * WEIGHTS.input + s.write5m * WEIGHTS.write5m + s.write1h * WEIGHTS.write1h + s.read * WEIGHTS.read);

const ROLES = [
  ['builder', /\b(builder|build(?:s|ing)?|fix(?:es|ing)?|implement)/i],
  ['interrogate', /\binterrogat/i],
  ['reviewer', /\b(reviewer|review(?:s|ing)?|verdict|test plan)\b/i],
  ['audit', /\baudit/i],
  ['design', /\bdesign\b/i],
  ['orchestrator', /\borchestrat/i],
];
const roleOf = (description) => ROLES.find(([, re]) => re.test(description))?.[0] ?? null;

/** A top-level session with no issue, by the skills it ran: a designer's, or the orchestrator's. */
function roleBySkills(skills) {
  if (skills.some((k) => k === 'melon-concept' || k === 'grilling')) return 'design';
  if (skills.includes('melon-mode')) return 'orchestrator';
  return null;
}

/**
 * Which issues and role a transcript belongs to. Subagents are named by the orchestrator
 * ("builder #127"); a top-level session counts as the builder of the issue its branch starts
 * with ("127-bond-wording").
 */
export function attribute({ description = '', branches = [], skills = [] }) {
  const issues = new Set([...description.matchAll(/(?:#|\bissue\s+)(\d+)/gi)].map((m) => Number(m[1])));
  let role = roleOf(description);
  if (issues.size === 0) {
    for (const b of branches) {
      const n = /^(\d+)-/.exec(b)?.[1];
      if (n) issues.add(Number(n));
    }
    if (issues.size && !role) role = 'builder';
    role ??= roleBySkills(skills);
  }
  return { issues: [...issues], role: role ?? (description ? 'other' : 'session') };
}

/**
 * Every transcript under the project directories for `repoRoot` (worktrees included). Only
 * sessions run on this machine leave transcripts here; cloud sessions keep theirs where they ran.
 */
export function collect(repoRoot, projectsDir = join(homedir(), '.claude', 'projects')) {
  if (!existsSync(projectsDir)) return [];
  const prefix = encodeProjectDir(repoRoot);
  const out = [];
  for (const dir of readdirSync(projectsDir).filter((d) => d.startsWith(prefix))) {
    const base = join(projectsDir, dir);
    for (const entry of readdirSync(base)) {
      if (entry.endsWith('.jsonl')) {
        const s = summarize(readFileSync(join(base, entry), 'utf8'));
        out.push({ file: join(dir, entry), description: '', ...s, ...attribute({ branches: [...s.branches], skills: [...s.skills] }) });
      }
      const subDir = join(base, entry, 'subagents');
      if (!existsSync(subDir)) continue;
      for (const f of readdirSync(subDir).filter((x) => x.endsWith('.jsonl'))) {
        const metaFile = join(subDir, f.replace(/\.jsonl$/, '.meta.json'));
        const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : {};
        const s = summarize(readFileSync(join(subDir, f), 'utf8'));
        const description = meta.description ?? '';
        out.push({ file: join(dir, entry, 'subagents', f), description, ...s, ...attribute({ description, branches: [] }) });
      }
    }
  }
  return out.filter((t) => t.calls > 0);
}

const branchIssue = (b) => {
  const n = /^(\d+)-/.exec(b ?? '')?.[1];
  return n ? Number(n) : null;
};

/** The part of a transcript whose calls ran on a branch `keep` accepts. */
function slice(t, keep) {
  const s = { ...t, ...zero() };
  for (const [b, c] of t.byBranch) {
    if (!keep(b)) continue;
    for (const k of COUNTS) s[k] += c[k];
    s.peak = Math.max(s.peak, c.peak);
  }
  return s;
}

/** A subagent named for an issue ("builder #12") belongs to that issue whole, whatever branch it sat on. */
const named = (t) => Boolean(t.description) && t.issues.length > 0;

/**
 * What belongs to a PR: every agent named for one of its issues, whole; from any other
 * transcript, only the calls made on the PR's branch or a branch named for one of its issues.
 */
export function forPr(transcripts, { issues, branch }) {
  const set = new Set(issues);
  const out = [];
  for (const t of transcripts) {
    if (named(t)) {
      if (t.issues.some((i) => set.has(i))) out.push(t);
    } else if (!t.byBranch) {
      if (t.issues.some((i) => set.has(i)) || (branch && t.branches.has(branch))) out.push(t);
    } else {
      const s = slice(t, (b) => (branch && b === branch) || set.has(branchIssue(b)));
      if (s.calls) out.push(s);
    }
  }
  return out;
}

export const totalInputEq = (list) => list.reduce((n, t) => n + inputEquivalent(t), 0);

/**
 * Cost over a period, by when each transcript started: attributed to work items, and overhead
 * (the orchestrator's own sessions, design and owner chats: anything with no issue).
 */
export function period(transcripts, { since, until = '9999-99-99' }) {
  const inWindow = transcripts.filter((t) => {
    const d = (t.first ?? '').slice(0, 10);
    return d >= since && d <= until;
  });
  const attributed = [];
  const overhead = [];
  for (const t of inWindow) {
    if (named(t) || !t.byBranch) {
      (t.issues.length ? attributed : overhead).push(t);
      continue;
    }
    // A session's calls on issue branches are work; the rest (on main, say) is overhead.
    const work = slice(t, (b) => branchIssue(b) !== null);
    const rest = slice(t, (b) => branchIssue(b) === null);
    if (work.calls) attributed.push(work);
    if (rest.calls) overhead.push({ ...rest, role: t.description ? t.role : (roleBySkills([...(t.skills ?? [])]) ?? 'session') });
  }
  return { attributed, overhead };
}

/**
 * Blocking findings in a review verdict: the count the marker states ("CHANGES @ <sha> (2 blocking)"),
 * else the top-level list items under a "Blocking" heading, however it's formatted (bold, a
 * markdown heading, a blank line before the list, numbered items).
 */
export function countBlocking(body) {
  const text = body ?? '';
  const stated = /^REVIEW VERDICT:\s*CHANGES\b[^\n]*\((\d+)\s+blocking\)/im.exec(text);
  if (stated) return Number(stated[1]);
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?Blocking\b/i.test(l));
  if (start === -1) return 0;
  let n = 0;
  for (const l of lines.slice(start + 1)) {
    if (!l.trim()) continue;
    const item = /^(\s*)(?:[-*+]|\d+[.)])\s+(\S.*)$/.exec(l);
    if (!item) {
      if (/^\s+\S/.test(l)) continue; // a wrapped line of the item above
      break; // the next section
    }
    if (item[1].length || /^none\b/i.test(item[2])) continue; // nested detail, or "none"
    n++;
  }
  return n;
}

export const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
