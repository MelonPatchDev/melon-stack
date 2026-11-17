import { execFileSync, spawnSync } from 'node:child_process';

/** Run a command and return trimmed stdout. Throws with stderr on a non-zero exit. */
export function run(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      ...opts,
    }).trim();
  } catch (err) {
    const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
    const e = new Error(`${cmd} ${args.join(' ')} failed: ${msg}`);
    e.status = err.status;
    throw e;
  }
}

/** Like `run`, but returns the exit status instead of throwing. */
export function tryRun(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  return { status: r.status, stdout: (r.stdout ?? '').trim(), stderr: (r.stderr ?? '').trim() };
}

export const git = (args, opts) => run('git', args, opts);
export const gh = (args, opts) => run('gh', args, opts);
export const ghJson = (args, opts) => JSON.parse(gh(args, opts) || 'null');

/** All pages of a REST list endpoint, flattened (`gh api --paginate --slurp`). */
export function ghApiList(path) {
  const pages = ghJson(['api', '--paginate', '--slurp', path]);
  return pages.flat();
}
