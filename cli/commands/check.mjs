// melon check: run the checks for what changed, keep full logs on disk, print only failures.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { comment } from '../lib/github.mjs';
import { failureExcerpt, selectChecks } from '../lib/rules.mjs';
import { git, tryRun } from '../lib/sh.mjs';

export const help = `melon check [--full] [--keep-going] [--record <pr>] [--list]
  Runs the configured checks whose paths match the files changed since the merge base with
  main (committed and uncommitted). Full output goes to .melon/logs/<check>.log; only failing
  lines are printed.
  --full         run every check
  --keep-going   don't stop at the first failure
  --record <pr>  on a pass with a clean tree, post "MELON CHECK: PASS @ <sha>" on the PR
                 (S-tier evidence for melon gate)
  --list         print which checks would run, and why, without running them`;

export function changedPaths(config) {
  const main = config.mainBranch;
  const base = tryRun('git', ['merge-base', 'HEAD', `origin/${main}`], { cwd: config.root });
  const committed = base.status === 0 ? git(['diff', '--name-only', base.stdout, 'HEAD'], { cwd: config.root }) : '';
  const dirty = git(['status', '--porcelain', '--untracked-files=all'], { cwd: config.root });
  const uncommitted = dirty
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(3).split(' -> ').pop());
  return { paths: [...new Set([...committed.split('\n').filter(Boolean), ...uncommitted])], dirty: dirty.length > 0 };
}

export function main(args, config) {
  const full = args.flags.full === true;
  const { paths, dirty } = changedPaths(config);
  const checks = selectChecks(config.checks, paths, { full, docsOnlyGlobs: config.docsOnly });

  if (args.flags.list) {
    console.log(`${paths.length} changed path(s). Would run: ${checks.map((c) => c.name).join(', ') || 'nothing'}`);
    return 0;
  }
  if (checks.length === 0) {
    console.log(paths.length === 0 ? 'No changes against main; nothing to check (use --full).' : 'No check matches the changed paths.');
    return 0;
  }

  const logDir = join(config.root, '.melon', 'logs');
  mkdirSync(logDir, { recursive: true });
  const results = [];
  for (const c of checks) {
    const started = Date.now();
    const r = spawnSync(c.run, { cwd: config.root, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: process.env });
    const output = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
    const log = join(logDir, `${c.name}.log`);
    writeFileSync(log, output);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    const ok = r.status === 0;
    results.push({ name: c.name, ok });
    console.log(`${ok ? '✓' : '✗'} ${c.name} (${secs}s)`);
    if (!ok) {
      console.log(failureExcerpt(output).replace(/^/gm, '    '));
      console.log(`    full log: ${log}`);
      if (!args.flags['keep-going']) break;
    }
  }

  const passed = results.length === checks.length && results.every((r) => r.ok);
  const skipped = checks.length - results.length;
  if (skipped > 0) console.log(`(${skipped} later check(s) not run; --keep-going runs them)`);

  if (args.flags.record) {
    if (!passed) {
      console.log('Not recorded: checks failed.');
    } else if (dirty) {
      console.log('Not recorded: uncommitted changes. Commit, then run again with --record.');
    } else {
      const sha = git(['rev-parse', 'HEAD'], { cwd: config.root });
      const mode = full ? 'full' : 'changed';
      comment('pr', args.flags.record, `MELON CHECK: PASS @ ${sha} (${mode}: ${checks.map((c) => c.name).join(', ')})\n\n[melon]`);
      console.log(`Recorded on PR #${args.flags.record} @ ${sha.slice(0, 9)}.`);
    }
  }
  return passed ? 0 : 1;
}
