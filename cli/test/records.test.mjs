import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decisionEntries,
  dependencies,
  graduations,
  graduationTarget,
  readiness,
  record,
  recordLabels,
  removeEntries,
  resolveRecords,
} from '../lib/records.mjs';

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

const LOG = `# Decision log
<!-- | D9 | commented out | x | x | x | #1 | -->
| # | Decision | Basis | Argued in | Graduates to | For |
|---|---|---|---|---|---|
| D1 | money is integer cents | ground rule 2 | #40 | a type | #41, #42 |
| D2 | unknown stays null | principle 13 | #40 | a test | #43 |
`;

test('decisionEntries: table rows only, with the work items each is for', () => {
  assert.deepEqual(decisionEntries(LOG), [
    { id: 'D1', for: [41, 42] },
    { id: 'D2', for: [43] },
  ]);
  assert.deepEqual(decisionEntries('| D1 | <one line> | b | #<issue> | g | #<work item> |'), [{ id: 'D1', for: [] }]);
});

test('removeEntries drops only the graduated rows', () => {
  const out = removeEntries(LOG, ['D1']);
  assert.doesNotMatch(out, /\| D1 \|/);
  assert.match(out, /\| D2 \| unknown stays null/);
  assert.match(out, /^\| # \| Decision/m);
});

test('graduations: "D<n> → where" and "->" lines, not inside comments', () => {
  const body = '## Decisions\n- D1 → `src/money.test.ts:42`\nD2 -> nothing: the code makes it obvious\n<!-- D7 → x.ts -->\n- D3 →\n';
  assert.deepEqual([...graduations(body)], [
    ['D1', '`src/money.test.ts:42`'],
    ['D2', 'nothing: the code makes it obvious'],
    ['D3', ''],
  ]);
});

test('graduationTarget: files and lines, but not prose or abbreviations', () => {
  assert.deepEqual(graduationTarget('`src/money.test.ts:42`'), { path: 'src/money.test.ts', line: 42 });
  assert.deepEqual(graduationTarget('ground rule in CLAUDE.md.'), { path: 'CLAUDE.md', line: null });
  assert.deepEqual(graduationTarget('type Money (./packages/core/money.ts:3-9)'), { path: 'packages/core/money.ts', line: 3 });
  assert.equal(graduationTarget('nothing: the code makes it obvious, e.g. the type'), null);
  assert.equal(graduationTarget('ground rule 4'), null);
});
