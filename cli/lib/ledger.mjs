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

export function summarize(text) {
  const seen = new Set();
  const s = { calls: 0, input: 0, write5m: 0, write1h: 0, read: 0, output: 0, peak: 0, branches: new Set(), models: new Set(), first: null, last: null };
  for (const line of text.split('\n')) {
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
    s.calls++;
    s.input += u.input_tokens ?? 0;
    s.write1h += w1h;
    s.write5m += write - w1h;
    s.read += u.cache_read_input_tokens ?? 0;
    s.output += u.output_tokens ?? 0;
    s.peak = Math.max(s.peak, (u.input_tokens ?? 0) + write + (u.cache_read_input_tokens ?? 0));
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

/**
 * Which issues and role a transcript belongs to. Subagents are named by the orchestrator
 * ("builder #127"); a top-level session counts as the builder of the issue its branch starts
 * with ("127-bond-wording").
 */
export function attribute({ description = '', branches = [] }) {
  const issues = new Set([...description.matchAll(/(?:#|\bissue\s+)(\d+)/gi)].map((m) => Number(m[1])));
  let role = roleOf(description);
  if (issues.size === 0) {
    for (const b of branches) {
      const n = /^(\d+)-/.exec(b)?.[1];
      if (n) issues.add(Number(n));
    }
    if (issues.size && !role) role = 'builder';
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
        out.push({ file: join(dir, entry), description: '', ...s, ...attribute({ branches: [...s.branches] }) });
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

/** Blocking findings in a review verdict: bullets under the "Blocking" heading. */
export function countBlocking(body) {
  const m = /^Blocking[^\n]*\n((?:[ \t]*[-*][^\n]*\n?)+)/im.exec(body ?? '');
  if (!m) return 0;
  return m[1].split('\n').filter((l) => /^\s*[-*]\s+\S/.test(l) && !/^\s*[-*]\s+none\b/i.test(l)).length;
}

export const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
