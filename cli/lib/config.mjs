import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const CONFIG_FILE = 'melon.config.json';

export const DEFAULTS = {
  mainBranch: 'main',
  timeZone: 'UTC',
  signature: '[orchestrator]',
  checks: [],
  docsOnly: ['docs/**', '**/*.md'],
  tiers: {
    h: [],
    hEdits: [],
    m: [],
    sMaxChurn: 400,
    churnIgnore: ['docs/**', '**/*.md', '**/fixtures/**', '**/__fixtures__/**', '**/*.snap', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'],
  },
  hotspots: [],
  migrations: { paths: [] },
  pr: {
    requiredSections: ['Plan', 'State', 'Data', 'Impact', 'Decisions', 'Unconfirmed facts'],
    impactLabel: 'What changes and why it matters',
  },
  todo: { pattern: '\\bTODO\\b(?!\\s*[(:]?\\s*#\\d+)', ignore: ['**/*.md'] },
  ci: { workflow: 'ci.yml', requiredFor: ['m', 'h'], batchAfterSMerges: 3 },
  batch: { minIssues: 3, labels: ['found-by-agent', 'bug'] },
  staleDays: 3,
  status: { untieredLabels: [] },
  records: {},
  areas: [],
  audits: {
    sourceGlobs: ['**/src/**/*.{ts,tsx}'],
    ignoreGlobs: ['**/*.test.{ts,tsx}', '**/test/**', '**/node_modules/**', '**/dist/**'],
    tokenFiles: [],
    componentMaxLines: 250,
    rulesDoc: null,
    envExample: '.env.example',
    allowedHosts: [],
  },
};

function merge(base, over) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over ?? {})) out[k] = k in base ? merge(base[k], v) : v;
  return out;
}

/** Walk up from `start` to the nearest melon.config.json; the repo root is its directory. */
export function findConfig(start = process.cwd()) {
  let dir = resolve(start);
  for (;;) {
    const file = join(dir, CONFIG_FILE);
    if (existsSync(file)) return file;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

export function loadConfig(start) {
  const file = findConfig(start);
  if (!file) {
    throw new Error(`No ${CONFIG_FILE} found from ${start ?? process.cwd()} upward. Run \`melon init\`.`);
  }
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  return { ...merge(DEFAULTS, raw), root: dirname(file), file };
}
