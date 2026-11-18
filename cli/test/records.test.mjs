import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addDecision,
  decisionEntries,
  dependencies,
  directionOrder,
  graduations,
  graduationTarget,
  readiness,
  record,
  recordLabels,
  nextDecisionId,
  placeInDirection,
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

test('dependencies: prose starting with "After" is not a dependency', () => {
  assert.deepEqual(dependencies('After the migration lands, see #12\nAfter: #4'), [4]);
});

test('graduationTarget: a test name after "›" survives line moves', () => {
  assert.deepEqual(graduationTarget('src/money.test.ts › "rejects negative amounts"'), { path: 'src/money.test.ts', line: null, name: 'rejects negative amounts' });
  assert.deepEqual(graduationTarget('`src/money.test.ts` > rejects negative'), { path: 'src/money.test.ts', line: null, name: 'rejects negative' });
  assert.deepEqual(graduationTarget('src/money.test.ts:42'), { path: 'src/money.test.ts', line: 42 });
});

test('decision ids never repeat, even after entries graduate and leave the log', () => {
  assert.equal(nextDecisionId(''), 'D1');
  assert.equal(nextDecisionId('| D3 | a | b | c | d | #1 |\n| D7 | a | b | c | d | #2 |'), 'D8');
  const { id, body } = addDecision('| D7 | a | b | c | d | #2 |', { decision: 'x', forItems: [5] });
  assert.equal(id, 'D8');
  assert.equal(nextDecisionId(removeEntries(body, ['D7', 'D8'])), 'D9', 'the mark outlives the rows');
});

test('addDecision appends after the table, makes a table when there is none, and keeps cells whole', () => {
  const log = '# Decision log\n\n| # | Decision | Basis | Argued in | Graduates to | For |\n|---|---|---|---|---|---|\n| D1 | a | b | #3 | t | #4 |\n\nNotes below.';
  const { body } = addDecision(log, { decision: 'cache a|b\nfor 5 min', basis: 'AC2', argued: '#9', graduates: 'a test', forItems: [4, 6] });
  assert.match(body, /\| D1 \| a \| b \| #3 \| t \| #4 \|\n\| D2 \| cache a\/b for 5 min \| AC2 \| #9 \| a test \| #4, #6 \|\n\nNotes below\./);
  assert.deepEqual(decisionEntries(body).map((e) => [e.id, e.for]), [['D1', [4]], ['D2', [4, 6]]]);

  const fresh = addDecision('# Decision log', { decision: 'x', forItems: [1] }).body;
  assert.match(fresh, /\| # \| Decision .*\n\|---.*\n\| D1 \| x \|  \|  \|  \| #1 \|/);
});

test('directionOrder: only the order section counts; first mention wins; comments do not count', () => {
  const body = '## Now: M2\nFor #50\n\n## Why this order\n1. #12: first\n2. #9 after #12\n<!-- #40 is an example -->\n\n## What would change the plan\n- If #45 slips, #9 moves up';
  assert.deepEqual([...directionOrder(body).keys()], [12, 9]);
  assert.deepEqual([...directionOrder('1. #12\n- open question on #3').keys()], [12, 3], 'no order section: the whole body');
});

test('placeInDirection inserts after an item or last, renumbers, and refuses duplicates', () => {
  const body = '## Why this order\n1. #12: first\n   unlocks the API\n2. #9: then\n\n## Bets\n- x';
  assert.equal(
    placeInDirection(body, 30, { after: 12, why: 'users asked | today' }).body,
    '## Why this order\n1. #12: first\n   unlocks the API\n2. #30: users asked / today\n3. #9: then\n\n## Bets\n- x\n',
  );
  assert.match(placeInDirection(body, 30, { why: 'later' }).body, /2\. #9: then\n3\. #30: later\n\n## Bets/);
  assert.match(placeInDirection(body, 9, { why: 'x' }).error, /already/);
  assert.match(placeInDirection(body, 30, { after: 77, why: 'x' }).error, /#77 isn't/);
  assert.equal(placeInDirection('# Direction', 5, { why: 'w' }).body, '# Direction\n\n## Why this order\n1. #5: w\n');
});
