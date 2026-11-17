import assert from 'node:assert/strict';
import { test } from 'node:test';
import { globToRegExp, matchesAny } from '../lib/glob.mjs';
import {
  addsMigration,
  causedBy,
  escapeReport,
  closedIssues,
  failureExcerpt,
  focusFiles,
  groupByArea,
  hasMarker,
  hotspotsHeld,
  impactSummary,
  isBelow,
  latestCheck,
  latestVerdict,
  ledgerLine,
  localDate,
  maxTier,
  missingSections,
  requiredTier,
  selectChecks,
  tierFromLabels,
  todoViolations,
} from '../lib/rules.mjs';
import { parseArgs } from '../melon.mjs';

test('globs: ** spans directories, * stays in one segment, {a,b} alternates', () => {
  assert.ok(matchesAny('packages/db/src/schema.ts', ['packages/db/**']));
  assert.ok(matchesAny('README.md', ['**/*.md']));
  assert.ok(matchesAny('docs/a/b.md', ['**/*.md']));
  assert.ok(!matchesAny('packages/dbx/a.ts', ['packages/db/**']));
  assert.ok(matchesAny('apps/web/src/A.tsx', ['apps/**/src/**/*.{ts,tsx}']));
  assert.ok(!globToRegExp('src/*.ts').test('src/a/b.ts'));
  assert.ok(matchesAny('docs/SPEC.md', ['docs/SPEC.md']));
});

const tiers = {
  h: ['packages/analytics/src/**', 'packages/db/src/schema.ts'],
  hEdits: ['docs/RULES.md'],
  m: ['packages/contracts/**'],
  sMaxChurn: 100,
  churnIgnore: ['docs/**', '**/*.md', '**/fixtures/**'],
};
const f = (path, additions = 1, deletions = 0) => ({ path, additions, deletions });

test('requiredTier: systemic paths are H; rule-doc edits are H, appends are not', () => {
  assert.equal(requiredTier([f('packages/analytics/src/x.ts')], tiers).tier, 'h');
  assert.equal(requiredTier([f('docs/RULES.md', 5, 0)], tiers).tier, 's');
  const edit = requiredTier([f('docs/RULES.md', 5, 2)], tiers);
  assert.equal(edit.tier, 'h');
  assert.match(edit.reasons[0], /edits existing rules/);
});

test('requiredTier: M for M paths, held hotspots and churn; docs and fixtures do not count', () => {
  assert.equal(requiredTier([f('packages/contracts/a.ts')], tiers).tier, 'm');
  assert.equal(requiredTier([f('apps/web/a.ts', 60, 50)], tiers).tier, 'm');
  assert.equal(requiredTier([f('apps/web/a.ts', 10), f('docs/x.md', 900), f('t/fixtures/y.json', 900)], tiers).tier, 's');
  const held = requiredTier([f('apps/web/a.ts')], tiers, { heldHotspots: ['profile'] });
  assert.equal(held.tier, 'm');
  assert.match(held.reasons[0], /hotspot profile/);
  assert.equal(requiredTier([], tiers).tier, 's');
});

test('focusFiles: systemic paths, rule edits and hotspots, nothing else', () => {
  const hs = [{ name: 'mappers', paths: ['apps/api/src/mappers.ts'] }];
  const files = [
    { ...f('packages/analytics/src/a.ts', 3, 2), status: 'modified' },
    { ...f('docs/RULES.md', 1, 1), status: 'modified' },
    { ...f('apps/api/src/mappers.ts', 4, 1), status: 'modified' },
    { ...f('apps/web/b.tsx', 40, 0), status: 'modified' },
  ];
  assert.deepEqual(
    focusFiles(files, tiers, hs).map((x) => `${x.path}:${x.churn}:${x.why}`),
    ['packages/analytics/src/a.ts:5:systemic path', 'docs/RULES.md:2:edits existing rules', 'apps/api/src/mappers.ts:5:hotspot mappers'],
  );
});

test('tier labels: one label, comparisons', () => {
  assert.deepEqual(tierFromLabels(['bug', 'tier:m']), { tier: 'm', count: 1 });
  assert.deepEqual(tierFromLabels(['tier:s', 'tier:h']), { tier: null, count: 2 });
  assert.deepEqual(tierFromLabels([]), { tier: null, count: 0 });
  assert.ok(isBelow('s', 'm'));
  assert.ok(!isBelow('h', 'm'));
  assert.equal(maxTier('s', 'h'), 'h');
});

const hotspots = [
  { name: 'contracts', paths: ['packages/contracts/**'], appendOnly: ['packages/contracts/src/index.ts'] },
  { name: 'mappers', paths: ['apps/api/src/mappers.ts'] },
];

test('hotspots: modifying holds, adding or append-only does not', () => {
  assert.deepEqual(hotspotsHeld([{ path: 'packages/contracts/src/new.ts', status: 'added', deletions: 0 }], hotspots), []);
  assert.deepEqual(hotspotsHeld([{ path: 'packages/contracts/src/index.ts', status: 'modified', deletions: 0 }], hotspots), []);
  assert.deepEqual(hotspotsHeld([{ path: 'packages/contracts/src/index.ts', status: 'modified', deletions: 1 }], hotspots), ['contracts']);
  assert.deepEqual(
    hotspotsHeld(
      [
        { path: 'apps/api/src/mappers.ts', status: 'modified', deletions: 3 },
        { path: 'packages/contracts/src/trade.ts', status: 'removed', deletions: 40 },
      ],
      hotspots,
    ),
    ['contracts', 'mappers'],
  );
});

test('migrations: only an added file under the paths counts', () => {
  const m = { paths: ['packages/db/drizzle/*.sql'] };
  assert.ok(addsMigration([{ path: 'packages/db/drizzle/0007_x.sql', status: 'added' }], m));
  assert.ok(!addsMigration([{ path: 'packages/db/drizzle/0006_x.sql', status: 'modified' }], m));
});

const body = `Closes #127

**Plan:** read bond wording.

**State:** ready for gate.

**Data:** none

## Impact
**What changes and why it matters:** bond and preferred lines no longer map as the issuer's stock. Bonds become unmappable.
**What it unlocks:** #107.

## Decisions
- x

Ledger: builder ~220k / reviewer ~134k tokens`;

test('PR body: sections as headings or bold labels', () => {
  assert.deepEqual(missingSections(body, ['Plan', 'State', 'Data', 'Impact', 'Decisions']), []);
  assert.deepEqual(missingSections(body, ['Unconfirmed facts']), ['Unconfirmed facts']);
});

test('closedIssues reads every closing keyword form', () => {
  assert.deepEqual(closedIssues(body), [127]);
  assert.deepEqual(closedIssues('Fixes #3, #4 and resolves #9'), [3, 4, 9]);
  assert.deepEqual(closedIssues('Refs #3'), []);
});

test('impactSummary: first sentence of the first Impact point; ledger line', () => {
  assert.equal(impactSummary(body), "bond and preferred lines no longer map as the issuer's stock.");
  assert.equal(impactSummary('nothing here'), null);
  assert.equal(ledgerLine(body), 'builder ~220k / reviewer ~134k tokens');
});

test('todoViolations: only added lines, issue-numbered TODOs pass', () => {
  const file = {
    path: 'a.ts',
    patch: '@@ -1,2 +1,4 @@\n const a = 1;\n+// TODO fix this\n+// TODO(#12) later\n-// TODO removed\n+// TODO #13 ok',
  };
  const pattern = '\\bTODO\\b(?!\\s*[(:]?\\s*#\\d+)';
  assert.deepEqual(todoViolations(file, pattern), [{ path: 'a.ts', line: 2, text: '// TODO fix this' }]);
});

test('verdicts, check records and markers: the latest wins', () => {
  const comments = [
    { body: 'TEST PLAN\n- case 1', createdAt: '1' },
    { body: 'REVIEW VERDICT: CHANGES @ abc1234\n...', createdAt: '2' },
    { body: 'MELON CHECK: PASS @ deadbeef (full: lint, test)', createdAt: '3' },
    { body: 'REVIEW VERDICT: APPROVE @ 0123456789abcdef\n[reviewer #5]', createdAt: '4' },
  ];
  assert.equal(latestVerdict(comments).verdict, 'APPROVE');
  assert.equal(latestVerdict(comments).sha, '0123456789abcdef');
  assert.deepEqual(latestCheck(comments), { result: 'PASS', sha: 'deadbeef', mode: 'full: lint, test', createdAt: '3' });
  assert.ok(hasMarker(comments, 'TEST PLAN'));
  assert.ok(!hasMarker(comments, 'PLAN AGREED'));
  assert.equal(latestVerdict([]), null);
});

const checks = [
  { name: 'lint', run: 'x', docsOnly: true },
  { name: 'test', run: 'x' },
  { name: 'e2e', run: 'x', paths: ['apps/web/**'] },
];

test('selectChecks: path filters, docs-only, full', () => {
  const docs = ['docs/**', '**/*.md'];
  assert.deepEqual(selectChecks(checks, ['docs/a.md'], { docsOnlyGlobs: docs }).map((c) => c.name), ['lint']);
  assert.deepEqual(selectChecks(checks, ['packages/x.ts'], { docsOnlyGlobs: docs }).map((c) => c.name), ['lint', 'test']);
  assert.deepEqual(selectChecks(checks, ['apps/web/a.tsx'], { docsOnlyGlobs: docs }).map((c) => c.name), ['lint', 'test', 'e2e']);
  assert.deepEqual(selectChecks(checks, [], { docsOnlyGlobs: docs }), []);
  assert.equal(selectChecks(checks, [], { full: true }).length, 3);
});

test('failureExcerpt keeps error lines and strips colour codes', () => {
  const out = 'ok 1\n\x1b[31mFAIL src/a.test.ts\x1b[0m\nok 2\nAssertionError: expected 1 to be 2';
  assert.equal(failureExcerpt(out), 'FAIL src/a.test.ts\nAssertionError: expected 1 to be 2');
  assert.equal(failureExcerpt('a\nb\nc', { tail: 2 }), 'b\nc');
});

test('localDate uses the configured zone', () => {
  const late = new Date('2026-11-18T03:30:00Z'); // 22:30 on the 17th in New York
  assert.equal(localDate(late, 'America/New_York'), '2026-11-17');
  assert.equal(localDate(late, 'UTC'), '2026-11-18');
});

test('groupByArea', () => {
  const g = groupByArea([
    { number: 1, labels: ['area:web'] },
    { number: 2, labels: ['bug'] },
    { number: 3, labels: ['area:web'] },
  ]);
  assert.deepEqual([...g.keys()], ['web', '(no area)']);
  assert.equal(g.get('web').length, 2);
});

test('parseArgs: value flags take the next word, others are booleans', () => {
  assert.deepEqual(parseArgs(['12', '--fix', '--ledger', 'b ~1k', '--min=4']), {
    positional: ['12'],
    flags: { fix: true, ledger: 'b ~1k', min: '4' },
  });
  assert.deepEqual(parseArgs(['--full', '--record', '7']), { positional: [], flags: { full: true, record: '7' } });
});

test('causedBy: "Caused by", "Regressed in", "Introduced in" lines', () => {
  assert.deepEqual(causedBy('Totals are off.\n**Caused by:** #12, #14\n- Regressed in #3'), [12, 14, 3]);
  assert.deepEqual(causedBy('Seen after #12 merged'), []);
});

test('escapeReport: escape rate per tier of the PRs that caused later issues', () => {
  const merged = [
    { number: 1, labels: ['tier:s'] },
    { number: 2, labels: ['tier:m'] },
    { number: 3, labels: ['tier:m'] },
    { number: 4, labels: [] },
  ];
  const issues = [
    { number: 50, body: 'Caused by: #2' },
    { number: 51, body: 'Caused by: #2' },
    { number: 52, body: 'Caused by: #99' }, // merged before the window
  ];
  assert.deepEqual(escapeReport(merged, issues), {
    s: { merged: 1, escaped: [] },
    m: { merged: 2, escaped: [{ pr: 2, issues: [50, 51] }] },
    '?': { merged: 1, escaped: [] },
  });
});
