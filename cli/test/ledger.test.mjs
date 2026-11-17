import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { attribute, collect, countBlocking, encodeProjectDir, inputEquivalent, summarize } from '../lib/ledger.mjs';

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
  assert.deepEqual(attribute({ description: 'Build issue 87 redesign' }), { issues: [87], role: 'builder' });
  assert.deepEqual(attribute({ description: 'Cold review of milestone issues' }), { issues: [], role: 'reviewer' });
  assert.deepEqual(attribute({ description: 'Research hosting stack options' }), { issues: [], role: 'other' });
  assert.deepEqual(attribute({ branches: ['main', '132-bond-wording'] }), { issues: [132], role: 'builder' });
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
