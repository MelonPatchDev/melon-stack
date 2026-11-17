// A fake `gh` for integration tests: answers from a JSON state file (FAKE_GH_STATE), applies
// writes to it, and logs every call (FAKE_GH_LOG). Only the calls the melon CLI makes exist.
const { appendFileSync, readFileSync, writeFileSync } = require('node:fs');

const statePath = process.env.FAKE_GH_STATE;
const state = JSON.parse(readFileSync(statePath, 'utf8'));
const argv = process.argv.slice(2);
appendFileSync(process.env.FAKE_GH_LOG, `${JSON.stringify(argv)}\n`);

const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const flags = (name) => argv.flatMap((a, i) => (a === `--${name}` ? [argv[i + 1]] : []));
const pick = (obj, fields) => Object.fromEntries(fields.split(',').map((f) => [f, obj[f]]));
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));
const out = (v) => process.stdout.write(typeof v === 'string' ? v : JSON.stringify(v));
const fail = (msg) => {
  process.stderr.write(msg);
  process.exit(1);
};
const labelObjs = (names) => names.map((name) => ({ name }));
const prJson = (p) => ({ ...p, labels: labelObjs(p.labels) });
const issueJson = (i) => ({ ...i, labels: labelObjs(i.labels) });
const now = () => new Date(Date.now() + (state.tick = (state.tick ?? 0) + 1) * 1000).toISOString();

const [group, cmd, num] = argv;
const pr = () => state.prs[num] ?? fail(`no PR ${num}`);
const issue = () => state.issues[num] ?? fail(`no issue ${num}`);

if (group === 'api') {
  const n = /pulls\/(\d+)\/files/.exec(argv.find((a) => a.includes('/pulls/')))?.[1];
  out([state.files[n] ?? []]);
} else if (group === 'pr' && cmd === 'view') {
  out(pick(prJson(pr()), flag('json')));
} else if (group === 'pr' && cmd === 'list') {
  const want = (flag('state') ?? 'open').toUpperCase();
  out(Object.values(state.prs).filter((p) => p.state === want).map((p) => pick(prJson(p), flag('json'))));
} else if (group === 'pr' && cmd === 'comment') {
  pr().comments.push({ body: flag('body'), createdAt: now() });
  save();
} else if (group === 'pr' && cmd === 'edit') {
  const p = pr();
  p.labels = [...p.labels.filter((l) => !flags('remove-label').includes(l)), ...flags('add-label')];
  save();
} else if (group === 'pr' && cmd === 'ready') {
  pr().isDraft = argv.includes('--undo');
  save();
} else if (group === 'pr' && cmd === 'merge') {
  const p = pr();
  if (flag('match-head-commit') !== p.headRefOid) fail('head moved');
  p.state = 'MERGED';
  p.mergedAt = now();
  p.mergedSubject = flag('subject');
  save();
} else if (group === 'issue' && cmd === 'view') {
  out(pick(issueJson(issue()), flag('json')));
} else if (group === 'issue' && cmd === 'list') {
  const label = flag('label');
  out(
    Object.values(state.issues)
      .filter((i) => (flag('state') === 'all' || i.state === 'OPEN') && (!label || i.labels.includes(label)))
      .map((i) => pick(issueJson(i), flag('json'))),
  );
} else if (group === 'issue' && cmd === 'create') {
  const n = String((state.nextIssue = (state.nextIssue ?? 500) + 1));
  state.issues[n] = { number: Number(n), title: flag('title'), body: flag('body'), labels: flag('label').split(','), state: 'OPEN', comments: [], updatedAt: now() };
  save();
  out(`https://github.com/o/r/issues/${n}\n`);
} else if (group === 'issue' && cmd === 'comment') {
  issue().comments.push({ body: flag('body'), createdAt: now() });
  save();
} else if (group === 'issue' && cmd === 'edit') {
  issue().labels.push(...flags('add-label'));
  if (flag('body') !== undefined) issue().body = flag('body');
  save();
} else if (group === 'issue' && cmd === 'close') {
  issue().state = 'CLOSED';
  save();
} else if (group === 'workflow' && cmd === 'run') {
  // logged only
} else if (group === 'label' && cmd === 'list') {
  out(state.labels.map((name) => ({ name })));
} else if (group === 'label' && cmd === 'create') {
  state.labels.push(num);
  save();
} else {
  fail(`fake gh: unsupported ${argv.join(' ')}`);
}
