import assert from 'node:assert/strict';
import { test } from 'node:test';
import { docsDrift, privacy, reactComposition, stateMachines, stripComments, styleDrift } from '../lib/audits.mjs';

test('stripComments removes comments but keeps URLs in strings', () => {
  const code = "const u = 'https://a.com/x'; // see #123\n/* #fff */ const c = 1;";
  const out = stripComments(code);
  assert.ok(out.includes('https://a.com/x'));
  assert.ok(!out.includes('#123'));
  assert.ok(!out.includes('#fff'));
});

test('state-machines: boolean flags and repeated status comparisons', () => {
  const flags = stateMachines([
    { path: 'A.tsx', text: 'const [a]=useState(false);const [b]=useState(false);const [c]=useState<boolean>(true);' },
    { path: 'B.ts', text: "if (job.status === 'queued') {} if (job.status === 'running') {}" },
    { path: 'C.ts', text: "if (status !== 'done') {}" },
  ]);
  assert.equal(flags.length, 2);
  assert.match(flags[0].note, /3 boolean useState/);
  assert.match(flags[1].note, /`status` compared against 3 string values across 2 files/);
});

test('style-drift: colour literals outside token files, not issue numbers; unused tokens', () => {
  const files = [
    { path: 'src/tokens.ts', text: "export const t = {\n  ink: '#111',\n  orphan: '#222',\n};" },
    { path: 'src/A.tsx', text: "const s = { color: '#ff0000', x: t.ink }; // fixes #123\nconst n = '(#123)';" },
  ];
  const flags = styleDrift(files, { tokenFiles: ['src/tokens.ts'] }, files);
  assert.equal(flags.length, 2);
  assert.match(flags[0].note, /1 colour literal/);
  assert.match(flags[1].note, /orphan/);
  assert.ok(!flags[1].note.includes('ink'));
});

test('react-composition: long files, derive-only effects, wide props', () => {
  const effect = 'function A() {\n  useEffect(() => {\n    setTotal(a + b);\n  }, [a, b]);\n}';
  const props = `function Wide({ ${Array.from({ length: 11 }, (_, i) => `p${i}`).join(', ')} }) {}`;
  const flags = reactComposition(
    [
      { path: 'A.tsx', text: effect },
      { path: 'W.tsx', text: props },
      { path: 'L.tsx', text: 'x\n'.repeat(300) },
      { path: 'skip.ts', text: effect },
    ],
    { componentMaxLines: 250 },
  );
  assert.deepEqual(flags.map((f) => f.path), ['A.tsx', 'W.tsx', 'L.tsx']);
});

test('privacy: unknown hosts and undeclared env vars', () => {
  const flags = privacy(
    [{ path: 'a.ts', text: "fetch('https://api.unknown-host.io/x'); fetch('https://api.known-provider.io/v2'); process.env.SECRET_X; process.env.DATABASE_URL; process.env.NODE_ENV" }],
    { allowedHosts: ['api.known-provider.io'], envExample: '.env.example' },
    'DATABASE_URL=postgres://x\n',
  );
  assert.equal(flags.length, 2);
  assert.match(flags[0].note, /api\.unknown-host\.io/);
  assert.match(flags[1].note, /SECRET_X/);
});

test('docs-drift: § references to missing sections', () => {
  const flags = docsDrift(
    [{ path: 'a.ts', text: '// per §6 and §15' }],
    { specDoc: 'docs/SPEC.md' },
    '## 6. Portfolio\n## 14. Simulator\n',
  );
  assert.equal(flags.length, 1);
  assert.match(flags[0].note, /§15/);
});

test('style-drift: tokens used as CSS custom properties count as used', () => {
  const files = [
    { path: 'src/tokens.ts', text: "export const t = {\n  'fg-muted': '#111',\n  fg: '#000',\n};" },
    { path: 'src/a.css', text: '.a { color: var(--fg-muted); }' },
  ];
  const flags = styleDrift(files, { tokenFiles: ['src/tokens.ts'] }, files);
  assert.equal(flags.length, 1);
  assert.match(flags[0].note, /: fg \(/);
});

test('docs-drift: legal citations and prose without the doc name are ignored', () => {
  const flags = docsDrift(
    [
      { path: 'CLAUDE.md', text: 'Federal law (5 U.S.C. §552) applies. See §9 of the rules.' },
      { path: 'docs/a.md', text: 'SPEC §15 says so.' },
    ],
    { specDoc: 'docs/SPEC.md' },
    '## 9. Sectors\n',
  );
  assert.deepEqual(flags.map((f) => `${f.path}:${f.line}`), ['docs/a.md:1']);
});
