import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dependencies, readiness, record, recordLabels, resolveRecords } from '../lib/records.mjs';

test('records default to GitHub and merge per-repo overrides', () => {
  const r = resolveRecords({ records: { decisionLog: { label: 'adr-open' }, direction: { kind: 'file', path: 'ROADMAP.md' } } });
  assert.deepEqual(r.decisionLog, { kind: 'github-issue', label: 'adr-open', title: 'Decision log' });
  assert.deepEqual(r.direction, { kind: 'file', path: 'ROADMAP.md', label: 'direction', title: 'Direction' });
  assert.equal(r.dailyLog.label, 'daily-log');
  assert.deepEqual(recordLabels({}).sort(), ['daily-log', 'decisions', 'direction', 'owner-attention']);
});

test('an unsupported kind is valid config but fails clearly when used', () => {
  const config = { records: { decisionLog: { kind: 'jira-page', space: 'ENG' } } };
  assert.equal(resolveRecords(config).decisionLog.kind, 'jira-page');
  assert.throws(() => record(config, 'decisionLog'), /records\.decisionLog\.kind "jira-page" isn't supported by the melon CLI yet/);
  assert.throws(() => record({}, 'nope'), /Unknown record "nope"/);
});

test('dependencies: "Depends on", "Blocked by" and "After" lines, bulleted or bold', () => {
  assert.deepEqual(dependencies('Goal: x\n**Depends on:** #12, #14\n- Blocked by #3\nAfter: #12'), [12, 14, 3]);
  assert.deepEqual(dependencies('Mentions #9 in passing'), []);
});

test('readiness: ready when every dependency is closed; unlocks is the reverse map', () => {
  const issues = [
    { number: 1, body: 'Depends on: #2' },
    { number: 2, body: '' },
    { number: 3, body: 'Depends on: #99' }, // #99 closed (not open)
  ];
  const { ready, waiting, unlocks } = readiness(issues);
  assert.deepEqual(ready.map((i) => i.number), [2, 3]);
  assert.deepEqual(waiting.map((w) => [w.issue.number, w.on]), [[1, [2]]]);
  assert.deepEqual(unlocks.get(2), [1]);
});
