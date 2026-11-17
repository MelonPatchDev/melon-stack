// melon gate: every mechanical merge condition, checked by script so no agent reasons about it.
import { matchesAny } from '../lib/glob.mjs';
import { getIssueComments, getPr, getPrFiles, listOpenPrs } from '../lib/github.mjs';
import {
  addsMigration,
  closedIssues,
  hasMarker,
  hotspotsHeld,
  isBelow,
  latestCheck,
  latestVerdict,
  maxTier,
  missingSections,
  requiredTier,
  tierFromLabels,
  todoViolations,
} from '../lib/rules.mjs';
import { gh, tryRun } from '../lib/sh.mjs';

export const help = `melon gate <pr> [--fix] [--json]
  Checks a PR against the mechanical merge conditions:
    tier label (raised automatically: H for systemic paths or edits to rule docs; M for M paths,
    held hotspots or code churn over tiers.sMaxChurn), needs-owner/parked, Closes #n, required PR
    sections, TODOs without an issue number, hotspot clashes and the migration slot against
    other open PRs, a clean merge with main, and evidence for its tier:
      S: a "MELON CHECK: PASS @ <sha>" comment covering the head (melon check --record)
      M/H: TEST PLAN + PLAN AGREED comments, and "REVIEW VERDICT: APPROVE @ <sha>" covering the head
  A recorded sha covers the head when the PR's only commits since are merges (merging main in).
  --fix   raise the tier label to what the paths require
  --json  print the results as JSON`;

/**
 * True when `sha` is the head, or the PR added no commits of its own since `sha` other than
 * merges: commits that arrived from main by merging it in don't count.
 */
function covers(sha, head, cwd, main) {
  if (!sha) return false;
  if (head.startsWith(sha) || sha.startsWith(head)) return true;
  const r = tryRun('git', ['rev-list', '--no-merges', `${sha}..${head}`, `^origin/${main}`], { cwd });
  return r.status === 0 && r.stdout === '';
}

export function evaluate(number, config, { fix = false } = {}) {
  const results = [];
  const add = (ok, name, detail = '') => results.push({ ok, name, detail });
  const warn = (name, detail) => results.push({ ok: true, warn: true, name, detail });

  const pr = getPr(number);
  const files = getPrFiles(number);

  const isOpen = pr.state === 'OPEN';
  const needsOwner = pr.labels.includes('needs-owner');
  const parked = pr.labels.includes('parked');
  add(isOpen, 'open', isOpen ? '' : pr.state);
  add(!needsOwner, 'no needs-owner label', needsOwner ? 'waits for an owner-only action' : '');
  add(!parked, 'not parked', parked ? 'remove `parked` first' : '');

  // Tier: one label, never below what the change requires (paths, edits, churn, hotspots).
  const held = hotspotsHeld(files, config.hotspots);
  const { tier: need, reasons } = requiredTier(files, config.tiers, { heldHotspots: held });
  const { tier: labelled, count } = tierFromLabels(pr.labels);
  const tier = labelled ? maxTier(labelled, need) : need;
  const why = need === 's' ? '' : ` (${reasons.slice(0, 3).join('; ')}${reasons.length > 3 ? '; …' : ''})`;
  if (count > 1) {
    add(false, 'one tier label', `found ${count}`);
  } else if (!labelled || isBelow(labelled, need)) {
    if (fix) {
      const argv = ['pr', 'edit', String(number), '--add-label', `tier:${need}`];
      if (labelled) argv.push('--remove-label', `tier:${labelled}`);
      gh(argv);
      add(true, 'tier label', `set tier:${need}${why}`);
    } else {
      add(false, 'tier label', `${labelled ? `tier:${labelled} is below` : 'missing; needs'} tier:${need}${why}. --fix sets it`);
    }
  } else {
    add(true, 'tier label', `tier:${tier}${need !== tier ? ` (the change alone needs tier:${need})` : ''}`);
  }

  // PR body.
  const issues = closedIssues(pr.body);
  add(issues.length > 0, 'closes an issue', issues.length ? issues.map((i) => `#${i}`).join(', ') : 'add "Closes #<n>"');
  const missing = missingSections(pr.body, config.pr.requiredSections);
  add(missing.length === 0, 'PR sections', missing.length ? `missing: ${missing.join(', ')}` : '');

  // TODOs in added lines.
  const todos = files.filter((f) => !matchesAny(f.path, config.todo.ignore)).flatMap((f) => todoViolations(f, config.todo.pattern));
  add(
    todos.length === 0,
    'TODOs have an issue number',
    todos.slice(0, 5).map((t) => `${t.path}:${t.line}`).join(', '),
  );

  // Hotspots and the migration slot against other open PRs.
  const migrates = addsMigration(files, config.migrations);
  if (held.length || migrates) {
    const others = listOpenPrs().filter((p) => p.number !== pr.number && !p.labels.includes('parked'));
    const clashes = [];
    const otherMigrations = [];
    for (const o of others) {
      const oFiles = getPrFiles(o.number);
      const shared = hotspotsHeld(oFiles, config.hotspots).filter((h) => held.includes(h));
      if (shared.length) clashes.push(`#${o.number} (${shared.join(', ')})`);
      if (migrates && addsMigration(oFiles, config.migrations)) otherMigrations.push(`#${o.number}`);
    }
    add(clashes.length === 0, 'no hotspot clash', clashes.length ? clashes.join('; ') : `holds ${held.join(', ') || 'none'}`);
    if (migrates) add(otherMigrations.length === 0, 'migration slot free', otherMigrations.join(', '));
  } else {
    add(true, 'no hotspot clash', 'holds none');
  }

  // Merge with main.
  const cwd = config.root;
  const main = config.mainBranch;
  const fetched = tryRun('git', ['fetch', '-q', 'origin', main, `+refs/pull/${number}/head:refs/melon/pr-${number}`], { cwd });
  const head = pr.headRefOid;
  if (fetched.status !== 0) {
    add(false, 'fetch', fetched.stderr);
  } else {
    const mt = tryRun('git', ['merge-tree', '--write-tree', '--name-only', '--no-messages', `origin/${main}`, head], { cwd });
    const conflictFiles = mt.stdout.split('\n').slice(1).filter(Boolean);
    add(mt.status === 0, 'merges cleanly with main', mt.status === 0 ? '' : conflictFiles.slice(0, 5).join(', ') || mt.stderr);
    const upToDate = tryRun('git', ['merge-base', '--is-ancestor', `origin/${main}`, head], { cwd }).status === 0;
    if (!upToDate) warn('contains latest main', 'main has moved; merge it in before CI (M/H) or merge');
  }

  // Evidence for the tier.
  if (tier === 's') {
    const rec = latestCheck(pr.comments);
    add(
      rec?.result === 'PASS' && covers(rec.sha, head, cwd, main),
      'checks recorded for the head',
      rec ? `${rec.result} @ ${rec.sha.slice(0, 9)} (${rec.mode})` : 'run `melon check --record <pr>`',
    );
  } else {
    const issueComments = issues.flatMap((i) => getIssueComments(i));
    const all = [...issueComments, ...pr.comments];
    const planned = hasMarker(all, 'TEST PLAN');
    const agreed = hasMarker(all, 'PLAN AGREED');
    add(planned, 'test plan posted', planned ? '' : 'reviewer posts TEST PLAN on the issue or PR');
    add(agreed, 'test plan agreed', agreed ? '' : 'builder posts PLAN AGREED (or the orchestrator, when it settles)');
    const v = latestVerdict(pr.comments);
    add(
      v?.verdict === 'APPROVE' && covers(v.sha, head, cwd, main),
      'reviewer approves the head',
      v ? `${v.verdict} @ ${v.sha.slice(0, 9)}${v.verdict === 'APPROVE' && !covers(v.sha, head, cwd, main) ? ' (new commits since)' : ''}` : 'no verdict yet',
    );
  }

  const ok = results.every((r) => r.ok);
  return { ok, tier, pr, files, results };
}

export function main(args, config) {
  const number = args.positional[0];
  if (!number) {
    console.log(help);
    return 2;
  }
  const r = evaluate(number, config, { fix: args.flags.fix === true });
  if (args.flags.json) {
    console.log(JSON.stringify({ ok: r.ok, tier: r.tier, results: r.results }, null, 2));
  } else {
    console.log(`Gate for #${number} (tier:${r.tier}): ${r.ok ? 'PASS' : 'FAIL'}`);
    for (const x of r.results) {
      const mark = !x.ok ? '✗' : x.warn ? '!' : '✓';
      console.log(`${mark} ${x.name}${x.detail ? ` — ${x.detail}` : ''}`);
    }
  }
  return r.ok ? 0 : 1;
}
