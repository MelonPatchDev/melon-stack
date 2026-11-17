// End-to-end runs of the commands that write to GitHub, against a real git repo (with a local bare
// "origin" holding refs/pull/<n>/head) and a fake `gh` that keeps state in a JSON file.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CLI = join(here, '..', 'melon.mjs');
const FAKE = join(here, 'fake-gh');

function setup() {
  const tmp = mkdtempSync(join(tmpdir(), 'melon-it-'));
  const env = {
    ...process.env,
    HOME: tmp, // keeps melon ledger away from the real ~/.claude
    PATH: `${FAKE}:${process.env.PATH}`,
    FAKE_GH_STATE: join(tmp, 'gh-state.json'),
    FAKE_GH_LOG: join(tmp, 'gh-log.jsonl'),
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@example.com',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@example.com',
  };
  const work = join(tmp, 'work');
  const g = (...args) => execFileSync('git', args, { cwd: work, env, encoding: 'utf8' }).trim();
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', join(tmp, 'origin.git')], { env });
  mkdirSync(work);
  g('init', '-q', '-b', 'main');
  writeFileSync(
    join(work, 'melon.config.json'),
    JSON.stringify({
      checks: [{ name: 'unit', run: 'echo unit ok' }],
      tiers: { h: ['core/**'], m: ['src/b.js'], sMaxChurn: 50 },
      pr: { requiredSections: ['Plan', 'State', 'Impact'] },
      ci: { workflow: 'ci.yml', requiredFor: ['m', 'h'], batchAfterSMerges: 2 },
      areas: ['web'],
    }),
  );
  writeFileSync(join(work, '.gitignore'), '.melon/\n');
  mkdirSync(join(work, 'src'));
  writeFileSync(join(work, 'src', 'a.js'), 'x\n');
  g('add', '.');
  g('commit', '-qm', 'init');
  g('remote', 'add', 'origin', join(tmp, 'origin.git'));
  g('push', '-q', 'origin', 'main');

  // PR 7 (S): a two-line change.
  g('checkout', '-qb', '7-small');
  writeFileSync(join(work, 'src', 'a.js'), 'x\ny\n');
  g('commit', '-qam', 'fix a');
  g('push', '-q', 'origin', 'HEAD:refs/pull/7/head');
  g('push', '-q', 'origin', 'HEAD:refs/pull/9/head');
  const sha7 = g('rev-parse', 'HEAD');

  // PR 10: edits the same line as PR 7 (a textual conflict between two open PRs).
  g('checkout', '-q', 'main');
  g('checkout', '-qb', '10-other');
  writeFileSync(join(work, 'src', 'a.js'), 'x\nz\n');
  g('commit', '-qam', 'other a');
  g('push', '-q', 'origin', 'HEAD:refs/pull/10/head');
  const sha10 = g('rev-parse', 'HEAD');

  // PR 8 (M): reviewed at A, then main moves and is merged in (a merge commit only).
  g('checkout', '-q', 'main');
  g('checkout', '-qb', '8-feature');
  writeFileSync(join(work, 'src', 'b.js'), 'feature\n');
  g('add', '.');
  g('commit', '-qm', 'feature');
  const shaA = g('rev-parse', 'HEAD');
  g('checkout', '-q', 'main');
  mkdirSync(join(work, 'docs'));
  writeFileSync(join(work, 'docs', 'x.md'), 'doc\n');
  g('add', '.');
  g('commit', '-qm', 'docs');
  g('push', '-q', 'origin', 'main');
  g('checkout', '-q', '8-feature');
  g('merge', '-q', '--no-edit', 'main');
  g('push', '-q', 'origin', 'HEAD:refs/pull/8/head');
  const shaM = g('rev-parse', 'HEAD');
  g('fetch', '-q', 'origin');
  g('checkout', '-q', '7-small');

  const body = (n) =>
    `Closes #${n}\n\n**Plan:** p\n\n**State:** ready for gate\n\n## Impact\n**What changes and why it matters:** the list now shows every row. More text.\n`;
  const pr = (number, extra) => ({
    number,
    title: `PR ${number}`,
    body: body(number + 100),
    labels: [],
    headRefName: '',
    headRefOid: '',
    baseRefName: 'main',
    isDraft: false,
    state: 'OPEN',
    comments: [],
    statusCheckRollup: [],
    updatedAt: new Date().toISOString(),
    url: '',
    ...extra,
  });
  const issue = (number, labels = [], comments = [], body = '') => ({ number, title: `Issue ${number}`, body, labels, state: 'OPEN', comments, updatedAt: new Date().toISOString() });
  writeFileSync(
    env.FAKE_GH_STATE,
    JSON.stringify({
      prs: {
        7: pr(7, { labels: ['tier:s'], headRefName: '7-small', headRefOid: sha7 }),
        8: pr(8, {
          labels: ['tier:m'],
          headRefName: '8-feature',
          headRefOid: shaM,
          isDraft: true,
          comments: [{ body: `REVIEW VERDICT: APPROVE @ ${shaA}\n- T1 ✓\n[reviewer #108]`, createdAt: '2026-01-01' }],
        }),
        9: pr(9, { labels: [], headRefName: '9-x', headRefOid: sha7 }),
        10: pr(10, { labels: ['tier:s', 'parked'], headRefName: '10-other', headRefOid: sha10 }),
      },
      files: {
        7: [{ filename: 'src/a.js', status: 'modified', additions: 1, deletions: 0, patch: '@@ -1 +1,2 @@\n x\n+y' }],
        8: [{ filename: 'src/b.js', status: 'added', additions: 1, deletions: 0, patch: '@@ -0,0 +1 @@\n+feature' }],
        9: [{ filename: 'src/b.js', status: 'modified', additions: 1, deletions: 0, patch: '@@ -1 +1,2 @@\n x\n+// TODO later' }],
      },
      issues: {
        107: issue(107, ['tier:s', 'status:ready'], [], 'Depends on: #109'),
        108: issue(108, [], [
          { body: 'TEST PLAN for #108\n- T1 · it works · unit · AC1', createdAt: '1' },
          { body: 'PLAN AGREED (settled by orchestrator)\n[orchestrator]', createdAt: '2' },
        ]),
        109: issue(109, ['tier:m', 'status:ready']),
        300: issue(300, ['decisions']),
        301: issue(301, ['owner-attention']),
        302: issue(302, ['direction']),
        20: issue(20, ['found-by-agent', 'area:web']),
        21: issue(21, ['bug', 'area:web', 'tier:s']),
        22: issue(22, ['found-by-agent', 'area:web']),
        23: issue(23, ['found-by-agent', 'area:web', 'tier:m']),
      },
      labels: ['bug', 'tier:s'],
    }),
  );
  writeFileSync(env.FAKE_GH_LOG, '');

  const run = (...args) => {
    const r = spawnSync(process.execPath, [CLI, ...args], { cwd: work, env, encoding: 'utf8' });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const calls = () =>
    readFileSync(env.FAKE_GH_LOG, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l).join(' '));
  const state = () => JSON.parse(readFileSync(env.FAKE_GH_STATE, 'utf8'));
  const setState = (fn) => {
    const s = state();
    fn(s);
    writeFileSync(env.FAKE_GH_STATE, JSON.stringify(s));
  };
  return { run, calls, state, setState, work, sha7, sha10, shaA, shaM, g };
}

test('S tier: gate needs recorded checks; merge squashes, logs and dispatches batch CI', () => {
  const t = setup();
  let r = t.run('gate', '7');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /✗ checks recorded for the head — run `melon check --record <pr>`/);

  r = t.run('check', '--record', '7');
  assert.equal(r.code, 0, r.out);
  assert.match(t.state().prs[7].comments[0].body, new RegExp(`^MELON CHECK: PASS @ ${t.sha7} \\(changed: unit\\)`));

  r = t.run('gate', '7');
  assert.equal(r.code, 0, r.out);

  r = t.run('merge', '7');
  assert.equal(r.code, 0, r.out);
  const s = t.state();
  assert.equal(s.prs[7].state, 'MERGED');
  assert.equal(s.prs[7].mergedSubject, 'PR 7 (#7)');
  const log = Object.values(s.issues).find((i) => i.labels.includes('daily-log'));
  assert.ok(log, 'daily-log issue created');
  assert.match(log.comments[0].body, /^- #7 the list now shows every row\. \(no transcripts found, 0 rounds, 0 findings\)/);
  assert.ok(t.calls().some((c) => c.startsWith(`pr merge 7 --squash --delete-branch --match-head-commit ${t.sha7}`)));
  assert.match(r.out, /S merges since CI covered main: 1\/2/);
  assert.ok(!t.calls().some((c) => c.startsWith('workflow run')));

  // A second S merge reaches the batch size and dispatches CI on main.
  t.setState((st) => {
    st.prs[7].state = 'OPEN';
  });
  r = t.run('merge', '7', '--ledger', 'manual');
  assert.equal(r.code, 0, r.out);
  assert.ok(t.calls().includes('workflow run ci.yml --ref main'));
  assert.equal(Object.values(t.state().issues).filter((i) => i.labels.includes('daily-log')).length, 1, 'reuses today\'s log');
});

test('M tier: settled plan + approval through a merge commit; draft → ready → dispatch → merge', () => {
  const t = setup();
  let r = t.run('gate', '8');
  assert.equal(r.code, 0, r.out); // APPROVE @ A covers head M: the only later commit is a merge
  assert.match(r.out, /reviewer approves the head — APPROVE @/);

  r = t.run('merge', '8');
  assert.equal(r.code, 3, r.out);
  assert.ok(t.calls().includes('pr ready 8'));
  assert.equal(t.state().prs[8].isDraft, false);

  r = t.run('merge', '8'); // ready, but no CI run on the head
  assert.equal(r.code, 3, r.out);
  assert.ok(t.calls().includes('workflow run ci.yml --ref 8-feature'));

  t.setState((s) => {
    s.prs[8].statusCheckRollup = [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' }];
  });
  r = t.run('merge', '8');
  assert.equal(r.code, 1, r.out);
  assert.ok(t.calls().includes('pr ready 8 --undo'));

  t.setState((s) => {
    s.prs[8].isDraft = false;
    s.prs[8].statusCheckRollup = [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' }];
  });
  r = t.run('merge', '8', '--ledger', 'b 1k');
  assert.equal(r.code, 0, r.out);
  assert.equal(t.state().prs[8].state, 'MERGED');
});

test('M tier: a new non-merge commit after the approval needs a new verdict', () => {
  const t = setup();
  t.setState((s) => {
    s.prs[8].comments = [{ body: `REVIEW VERDICT: APPROVE @ ${t.sha7}\n[reviewer #108]`, createdAt: '1' }];
  });
  const r = t.run('gate', '8');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /✗ reviewer approves the head — APPROVE @ \w+ \(new commits since\)/);
});

test('gate --fix raises the tier; TODOs and missing labels fail', () => {
  const t = setup();
  let r = t.run('gate', '9');
  assert.equal(r.code, 1);
  assert.match(r.out, /✗ tier label — missing; needs tier:m \(src\/b\.js \(M path\)\)/);
  assert.match(r.out, /✗ TODOs have an issue number — src\/b\.js:2/);
  r = t.run('gate', '9', '--fix');
  assert.ok(t.calls().includes('pr edit 9 --add-label tier:m'));
  assert.deepEqual(t.state().prs[9].labels, ['tier:m']);
});

test('batch --create groups small issues by area; skips M-tier and batched ones', () => {
  const t = setup();
  const r = t.run('batch', '--create');
  assert.equal(r.code, 0, r.out);
  const s = t.state();
  const batch = Object.values(s.issues).find((i) => i.title.startsWith('Maintenance: web'));
  assert.ok(batch, r.out);
  assert.deepEqual(batch.labels, ['tier:s', 'area:web', 'maintenance']);
  assert.match(batch.body, /- \[ \] #20 [\s\S]*#21[\s\S]*#22/);
  assert.ok(!batch.body.includes('#23'));
  for (const n of [20, 21, 22]) {
    assert.ok(s.issues[n].labels.includes('batched'));
    assert.match(s.issues[n].comments[0].body, new RegExp(`Batched into #${batch.number}`));
  }
  assert.ok(!s.issues[23].labels.includes('batched'));
});

test('labels --apply creates only the missing labels', () => {
  const t = setup();
  const r = t.run('labels', '--apply');
  assert.equal(r.code, 0, r.out);
  const created = t.calls().filter((c) => c.startsWith('label create'));
  assert.ok(!created.some((c) => c.startsWith('label create bug ') || c.startsWith('label create tier:s ')));
  assert.ok(created.some((c) => c.startsWith('label create tier:h ')));
  assert.ok(created.some((c) => c.startsWith('label create area:web ')));
});

test('focus lists the files that need a deep read', () => {
  const t = setup();
  t.setState((s) => {
    s.files[8].push({ filename: 'core/calc.js', status: 'modified', additions: 3, deletions: 1 });
  });
  const r = t.run('focus', '8');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /the change alone needs tier:h/);
  assert.match(r.out, /- core\/calc\.js \(4 lines; systemic path\)/);
  assert.match(r.out, /Skim \(1 files/);
  assert.ok(existsSync(t.work));
});

test('init vendors the CLI without tests and keeps it out of the repo tooling, idempotently', () => {
  const repo = mkdtempSync(join(tmpdir(), 'melon-init-'));
  execFileSync('git', ['init', '-q', repo]);
  writeFileSync(join(repo, '.prettierignore'), 'dist/'); // no trailing newline
  writeFileSync(join(repo, '.eslintignore'), 'build/\n');
  writeFileSync(join(repo, 'eslint.config.js'), 'export default [{ ignores: ["dist/**"] }];\n');
  const init = () => spawnSync(process.execPath, [CLI, 'init', repo], { encoding: 'utf8' });

  let r = init();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(existsSync(join(repo, 'tools/melon/melon.mjs')));
  assert.ok(!existsSync(join(repo, 'tools/melon/test')), 'tests are not vendored');
  assert.match(readFileSync(join(repo, 'tools/melon/VERSION'), 'utf8'), /^\d+\.\d+\.\d+\n$/);
  assert.equal(readFileSync(join(repo, '.prettierignore'), 'utf8'), 'dist/\ntools/melon/\n');
  assert.equal(readFileSync(join(repo, '.eslintignore'), 'utf8'), 'build/\ntools/melon/\n');
  assert.equal(readFileSync(join(repo, '.gitignore'), 'utf8'), '.melon/\n');
  assert.match(r.stdout, /add 'tools\/melon\/\*\*' to the `ignores` array in eslint\.config\.js/);

  r = init();
  assert.equal(r.status, 0);
  assert.equal(readFileSync(join(repo, '.prettierignore'), 'utf8'), 'dist/\ntools/melon/\n', 'nothing added twice');
  assert.equal(readFileSync(join(repo, '.gitignore'), 'utf8'), '.melon/\n');
  assert.match(r.stdout, /melon\.config\.json exists; left as is/);

  writeFileSync(join(repo, 'eslint.config.js'), 'export default [{ ignores: ["dist/**", "tools/melon/**"] }];\n');
  assert.doesNotMatch(init().stdout, /ESLint flat config/);

  const plain = mkdtempSync(join(tmpdir(), 'melon-init-plain-'));
  execFileSync('git', ['init', '-q', plain]);
  assert.equal(spawnSync(process.execPath, [CLI, 'init', plain], { encoding: 'utf8' }).status, 0);
  assert.ok(!existsSync(join(plain, '.prettierignore')), 'no Prettier, no .prettierignore');
});

test('status: ready vs waiting on dependencies, unlocks, record issues left out', () => {
  const t = setup();
  t.setState((s) => {
    s.prs[7].state = 'CLOSED'; // otherwise #107 and #109 count as already in a PR
    s.prs[9].state = 'CLOSED';
  });
  const r = t.run('status', '--no-slots');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /## Ready to start \(dependencies closed\) \(1\)\n- #109 Issue 109 \[tier:m\] · unlocks #107/);
  assert.match(r.out, /## Waiting on dependencies \(1\)\n- #107 Issue 107 \[tier:s\] · waits on #109/);
  assert.doesNotMatch(r.out, /#30[012] /, 'record issues are not work');
});

test('records --check finds each record, and a missing one fails', () => {
  const t = setup();
  let r = t.run('records', '--check');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\| decisionLog \| GitHub issue labelled `decisions` ✓ #300 \|/);
  assert.match(r.out, /\| dailyLog \| GitHub issue labelled `daily-log` \(one per day\) · created on the first merge \|/);
  t.setState((s) => {
    s.issues[302].state = 'CLOSED';
  });
  r = t.run('records', '--check');
  assert.equal(r.code, 1);
  assert.match(r.out, /\| direction \| GitHub issue labelled `direction` ✗ missing \|/);
});

test('gate warns about a conflict with another open PR; parked PRs are skipped', () => {
  const t = setup();
  t.setState((s) => {
    s.prs[10].labels = ['tier:s'];
  });
  let r = t.run('gate', '7');
  assert.match(r.out, /! no conflict with other open PRs — conflicts with #10 \(src\/a\.js\)/);
  t.setState((s) => {
    s.prs[10].labels = ['tier:s', 'parked'];
  });
  r = t.run('gate', '7');
  assert.doesNotMatch(r.out, /conflicts with #10/);
});

test('merge writes the daily log where records.dailyLog says', () => {
  const t = setup();
  const cfgPath = join(t.work, 'melon.config.json');
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  cfg.records = { dailyLog: { label: 'merge-log', titlePrefix: 'Merges ' } };
  writeFileSync(cfgPath, JSON.stringify(cfg));
  t.g('commit', '-qam', 'config');
  t.g('push', '-q', '-f', 'origin', 'HEAD:refs/pull/7/head');
  t.setState((s) => {
    s.prs[7].headRefOid = t.g('rev-parse', 'HEAD');
  });
  assert.equal(t.run('check', '--record', '7').code, 0);
  const r = t.run('merge', '7', '--ledger', 'x');
  assert.equal(r.code, 0, r.out);
  const log = Object.values(t.state().issues).find((i) => i.labels.includes('merge-log'));
  assert.match(log.title, /^Merges \d{4}-\d{2}-\d{2}$/);
});

test('decisions graduate: gate holds the PR to its open entries; merge removes them', () => {
  const t = setup();
  const log = '| # | Decision | Basis | Argued in | Graduates to | For |\n|---|---|---|---|---|---|\n| D1 | b is a feature | AC1 | #108 | a test | #108 |\n| D2 | other work | AC2 | #40 | a test | #41 |\n';
  const merge = (body) =>
    t.setState((s) => {
      s.issues[300].body = log;
      s.prs[8].body = `${s.prs[8].body}\n## Decisions\n${body}\n`;
    });

  merge('');
  let r = t.run('gate', '8');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /✗ decisions graduate — D1 open in the decision log \(#300\) for this work/);

  t.setState((s) => {
    s.prs[8].body = s.prs[8].body.replace('## Decisions\n', '## Decisions\n- D1 → `src/b.js:5`\n');
  });
  r = t.run('gate', '8');
  assert.match(r.out, /✗ decisions graduate — D1 → src\/b\.js:5 is past the end \(1 lines\)/);

  t.setState((s) => {
    s.prs[8].body = s.prs[8].body.replace('src/b.js:5', 'src/b.js:1');
  });
  r = t.run('gate', '8');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /✓ decisions graduate — D1/);

  t.setState((s) => {
    s.prs[8].isDraft = false;
    s.prs[8].statusCheckRollup = [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' }];
  });
  r = t.run('merge', '8', '--ledger', 'x');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Decision log #300: D1 graduated and removed\./);
  const body = t.state().issues[300].body;
  assert.doesNotMatch(body, /\| D1 \|/);
  assert.match(body, /\| D2 \| other work/);
});

test('gate: a graduation naming a file the PR lacks fails', () => {
  const t = setup();
  t.setState((s) => {
    s.prs[8].body += '\n## Decisions\n- D4 → src/nope.test.js:3\n- D5 → nothing: the type makes it obvious\n';
  });
  const r = t.run('gate', '8');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /✗ decisions graduate — D4 → src\/nope\.test\.js isn't in the PR$/m);
});

test('escapes: merge tags the fix in the daily log; the report counts escapes per tier', () => {
  const t = setup();
  t.setState((s) => {
    s.prs[8].state = 'MERGED';
    s.prs[8].mergedAt = new Date().toISOString();
    s.issues[107].body = 'Totals off by one.\nCaused by: #8';
  });
  assert.equal(t.run('check', '--record', '7').code, 0);
  let r = t.run('merge', '7', '--ledger', 'x');
  assert.equal(r.code, 0, r.out);
  const log = Object.values(t.state().issues).find((i) => i.labels.includes('daily-log'));
  assert.match(log.comments[0].body, /^- #7 .* \(x\) · fixes an escape from #8 \(tier:m\)/);

  r = t.run('escapes');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\| s \| 1 \| 0 \| 0% \| — \|/);
  assert.match(r.out, /\| m \| 1 \| 1 \| 100% \| #8 → #107 \|/);
  assert.equal(t.run('escapes', '--since', 'yesterday').code, 2);
});
