import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { attribute, collect, countBlocking, encodeProjectDir, forPr, inputEquivalent, period, summarize } from '../lib/ledger.mjs';

const call = (id, u, extra = {}) =>
  JSON.stringify({ type: 'assistant', gitBranch: 'main', timestamp: 't', message: { id, model: 'm', usage: u }, ...extra });

test('summarize de-duplicates calls by message id and splits cache writes', () => {
  const u = { input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: 5, cache_creation: { ephemeral_1h_input_tokens: 40 } };
  const text = [call('a', u), call('a', u), call('b', { ...u, cache_read_input_tokens: 3000 }), '{"type":"user"}', 'not json'].join('\n');
  const s = summarize(text);
  assert.equal(s.calls, 2);
  assert.equal(s.read, 4000);
  assert.equal(s.write1h, 80);
  assert.equal(s.write5m, 120);
  assert.equal(s.peak, 3110);
  // 20 input + 120*1.25 + 80*2 + 4000*0.1
  assert.equal(inputEquivalent(s), 20 + 150 + 160 + 400);
});

test('attribute: subagent descriptions, then branch names', () => {
  assert.deepEqual(attribute({ description: 'reviewer #127' }), { issues: [127], role: 'reviewer' });
  assert.deepEqual(attribute({ description: 'interrogate #127' }), { issues: [127], role: 'interrogate' });
  assert.deepEqual(attribute({ description: 'Build issue 87 redesign' }), { issues: [87], role: 'builder' });
  assert.deepEqual(attribute({ description: 'Cold review of milestone issues' }), { issues: [], role: 'reviewer' });
  assert.deepEqual(attribute({ description: 'Research hosting stack options' }), { issues: [], role: 'other' });
  assert.deepEqual(attribute({ branches: ['main', '132-bond-wording'] }), { issues: [132], role: 'builder' });
  assert.deepEqual(attribute({ branches: ['main'], skills: ['grilling', 'melon-mode'] }), { issues: [], role: 'design' });
  assert.deepEqual(attribute({ branches: ['main'], skills: ['melon-mode'] }), { issues: [], role: 'orchestrator' });
  assert.deepEqual(attribute({ branches: ['132-x'], skills: ['melon-concept'] }), { issues: [132], role: 'builder' });
  assert.deepEqual(attribute({ branches: ['main'] }), { issues: [], role: 'session' });
});

test('collect finds sessions and subagents for the repo and its worktrees only', () => {
  const root = mkdtempSync(join(tmpdir(), 'ledger-'));
  const repo = '/home/u/dev/app';
  const u = { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 };
  const mk = (dir, file, lines) => {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, dir, file), lines.join('\n'));
  };
  mk(encodeProjectDir(repo), 's1.jsonl', [call('x', u, { gitBranch: '12-fix' })]);
  mk(join(encodeProjectDir(repo), 's1', 'subagents'), 'agent-a.jsonl', [call('y', u), call('z', u)]);
  writeFileSync(join(root, encodeProjectDir(repo), 's1', 'subagents', 'agent-a.meta.json'), JSON.stringify({ description: 'reviewer #12' }));
  mk(encodeProjectDir(`${repo}/.claude/worktrees/agent-1`), 's2.jsonl', [call('w', u, { gitBranch: '13-x' })]);
  mk(encodeProjectDir('/home/u/dev/other'), 's3.jsonl', [call('v', u, { gitBranch: '12-fix' })]);
  const found = collect(repo, root).map((t) => `${t.role}:${t.issues.join(',')}:${t.calls}`).sort();
  assert.deepEqual(found, ['builder:12:1', 'builder:13:1', 'reviewer:12:2']);
});

test('countBlocking counts bullets under Blocking, not "none"', () => {
  assert.equal(countBlocking('REVIEW VERDICT: CHANGES @ abc\n\nBlocking (each with proof):\n- a · proof x\n- b · proof y\n\nNotes:\n- n'), 2);
  assert.equal(countBlocking('Blocking:\n- none\n'), 0);
  assert.equal(countBlocking('no section'), 0);
});

test('countBlocking: the marker\'s stated count wins; otherwise any common list formatting counts', () => {
  assert.equal(countBlocking('REVIEW VERDICT: CHANGES @ abc (2 blocking)\n\nBlocking:\n- a\n'), 2);
  const v = 'REVIEW VERDICT: CHANGES @ abc\n\n';
  assert.equal(countBlocking(`${v}**Blocking**\n- a · proof\n`), 1);
  assert.equal(countBlocking(`${v}### Blocking\n- a\n  - detail\n- b\n`), 2);
  assert.equal(countBlocking(`${v}Blocking:\n\n1. a\n2. b\n\nNotes:\n- n\n`), 2);
  assert.equal(countBlocking(`${v}Blocking:\n- a, with a wrapped\n  second line\n**Notes**\n- n\n`), 1);
});

test('summarize keeps per-branch totals and the latest context size', () => {
  const u = (read) => ({ input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: read, output_tokens: 1 });
  const s = summarize([call('a', u(100), { gitBranch: 'main' }), call('b', u(900), { gitBranch: '12-fix' }), call('c', u(400), { gitBranch: 'main' })].join('\n'));
  assert.equal(s.ctx, 401);
  assert.equal(s.peak, 901);
  assert.equal(s.byBranch.get('main').calls, 2);
  assert.equal(s.byBranch.get('12-fix').read, 900);
});

test('forPr charges a long session only for its calls on the PR\'s branch; named agents whole', () => {
  const u = (read) => ({ input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: read, output_tokens: 0 });
  const session = { description: '', ...summarize([call('a', u(1000), { gitBranch: 'main' }), call('b', u(50), { gitBranch: '12-fix' }), call('c', u(2000), { gitBranch: '13-y' })].join('\n')) };
  Object.assign(session, attribute({ branches: [...session.branches] }));
  const reviewer = { description: 'reviewer #12', ...summarize(call('d', u(70), { gitBranch: 'main' })) };
  Object.assign(reviewer, attribute({ description: reviewer.description }));
  const other = { description: 'builder #13', ...summarize(call('e', u(80), { gitBranch: '12-fix' })) };
  Object.assign(other, attribute({ description: other.description }));
  const got = forPr([session, reviewer, other], { issues: [12], branch: '12-fix' });
  assert.deepEqual(got.map((t) => [t.role, t.calls, t.read]), [['builder', 1, 50], ['reviewer', 1, 70]]);

  const p = period([{ ...session, first: '2026-03-01T00:00Z' }], { since: '2026-03-01' });
  assert.deepEqual(p.attributed.map((t) => t.read), [2050]);
  assert.deepEqual(p.overhead.map((t) => [t.role, t.read]), [['session', 1000]]);
});

test('period splits attributed work from overhead; forPr matches issues or branch', () => {
  const t = (first, issues, branch = 'main') => ({ first, issues, branches: new Set([branch]), input: 10, write5m: 0, write1h: 0, read: 0 });
  const all = [t('2026-03-01T10:00Z', [5]), t('2026-03-02T09:00Z', []), t('2026-02-01T00:00Z', []), t('2026-03-03T00:00Z', [], '6-x')];
  const p = period(all, { since: '2026-03-01' });
  assert.equal(p.attributed.length, 1);
  assert.equal(p.overhead.length, 2);
  assert.equal(forPr(all, { issues: [5], branch: '6-x' }).length, 2);
});

test('summarize records the skills a session ran, by tool call or slash command', () => {
  const text = [
    JSON.stringify({ type: 'user', message: { content: '<command-name>/melon-stack:melon-concept</command-name>' } }),
    JSON.stringify({ type: 'assistant', message: { id: 'a', content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'grilling' } }], usage: { input_tokens: 1 } } }),
  ].join('\n');
  assert.deepEqual([...summarize(text).skills].sort(), ['grilling', 'melon-concept']);
});
