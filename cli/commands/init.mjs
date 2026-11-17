// melon init: vendor the CLI into a target repo (so every worktree and CI uses the same version
// without knowing where the plugin lives) and write a starter config.
import { appendFileSync, cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_FILE } from '../lib/config.mjs';

export const help = `melon init [<repo-dir>] [--to <path>]
  Copies the CLI into <repo-dir>/tools/melon (or --to), without its tests, and writes a starter
  melon.config.json if there is none. Keeps the copy out of the repo's own tooling: adds .melon/
  to .gitignore, the copy to .prettierignore (when the repo uses Prettier) and to a legacy
  .eslintignore, and prints the line to add to an ESLint flat config. Re-run to update the copy;
  nothing is added twice.`;

/** Append `line` to `file` unless an identical line is already there. Returns true if added. */
export function ensureLine(file, line) {
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (text.split(/\r?\n/).some((l) => l.trim() === line)) return false;
  appendFileSync(file, `${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`);
  return true;
}

const usesPrettier = (repo) => {
  if (readdirSync(repo).some((f) => f === '.prettierignore' || f.startsWith('.prettierrc') || f.startsWith('prettier.config'))) return true;
  const pkg = join(repo, 'package.json');
  if (!existsSync(pkg)) return false;
  const p = JSON.parse(readFileSync(pkg, 'utf8'));
  return Boolean(p.prettier || p.devDependencies?.prettier || p.dependencies?.prettier);
};

const CLI_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const STARTER = {
  $comment: 'melon-stack config. See docs/config.md in melon-stack for every field.',
  mainBranch: 'main',
  timeZone: 'UTC',
  checks: [
    { name: 'lint', run: 'pnpm lint', docsOnly: true },
    { name: 'typecheck', run: 'pnpm typecheck' },
    { name: 'test', run: 'pnpm test' },
    { name: 'build', run: 'pnpm build' },
  ],
  tiers: { h: [], m: ['apps/**', 'packages/**'] },
  hotspots: [],
  migrations: { paths: [] },
  areas: ['web', 'api', 'docs', 'process'],
};

export function main(args) {
  const repo = resolve(args.positional[0] ?? process.cwd());
  if (!existsSync(join(repo, '.git'))) {
    console.log(`${repo} is not a git repository root.`);
    return 2;
  }
  const dest = resolve(repo, args.flags.to ?? 'tools/melon');
  if (dest === CLI_DIR) {
    console.log('Already running from the vendored copy; run init from the melon-stack plugin to update it.');
    return 2;
  }
  cpSync(CLI_DIR, dest, { recursive: true, filter: (src) => !relative(CLI_DIR, src).startsWith('test') });
  const vendoredVersion = join(CLI_DIR, 'VERSION');
  const version = existsSync(vendoredVersion)
    ? readFileSync(vendoredVersion, 'utf8').trim()
    : JSON.parse(readFileSync(resolve(CLI_DIR, '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;
  writeFileSync(join(dest, 'VERSION'), `${version}\n`);
  console.log(`Vendored melon CLI ${version} into ${relative(repo, dest)}/`);

  const cfg = join(repo, CONFIG_FILE);
  if (existsSync(cfg)) {
    console.log(`${CONFIG_FILE} exists; left as is.`);
  } else {
    writeFileSync(cfg, `${JSON.stringify(STARTER, null, 2)}\n`);
    console.log(`Wrote a starter ${CONFIG_FILE}; fill in checks, tiers, hotspots and migrations.`);
  }

  // Keep the vendored copy out of the repo's own lint and format checks: it follows
  // melon-stack's style, and a failing `pnpm lint` on code no builder wrote wastes a round.
  const rel = relative(repo, dest).split('\\').join('/');
  if (ensureLine(join(repo, '.gitignore'), '.melon/')) console.log('Added .melon/ to .gitignore.');
  if (usesPrettier(repo) && ensureLine(join(repo, '.prettierignore'), `${rel}/`)) console.log(`Added ${rel}/ to .prettierignore.`);
  if (existsSync(join(repo, '.eslintignore')) && ensureLine(join(repo, '.eslintignore'), `${rel}/`)) console.log(`Added ${rel}/ to .eslintignore.`);
  const flat = readdirSync(repo).find((f) => /^eslint\.config\.(js|mjs|cjs|ts|mts|cts)$/.test(f));
  if (flat && !readFileSync(join(repo, flat), 'utf8').includes(`${rel}/**`)) {
    console.log(`\nESLint flat config: add '${rel}/**' to the \`ignores\` array in ${flat}.`);
  }

  console.log(`\nAdd to package.json scripts:  "melon": "node ${relative(repo, dest)}/melon.mjs"`);
  if (usesPrettier(repo)) console.log(`Format the config with your formatter: pnpm prettier --write ${CONFIG_FILE}`);
  console.log('Then: pnpm melon labels --apply');
  return 0;
}
