// melon audit <name>: run an audit's flagging script. The audit skill then reads only the
// flagged files, which keeps a whole-repo audit to one focused model pass.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUDITS } from '../lib/audits.mjs';
import { matchesAny } from '../lib/glob.mjs';
import { git } from '../lib/sh.mjs';

export const help = `melon audit <name> [--limit <n>]
  Audits: ${Object.keys(AUDITS).join(', ')}
  Prints the files and lines the scan flags, plus the question the model pass should answer.
  docs-drift scans every tracked code and Markdown file; style-drift adds CSS; the others
  scan audits.sourceGlobs.`;

export function main(args, config) {
  const name = args.positional[0];
  const audit = AUDITS[name];
  if (!audit) {
    console.log(help);
    return 2;
  }
  const cfg = config.audits;
  const tracked = git(['ls-files'], { cwd: config.root }).split('\n').filter(Boolean);
  const globs = {
    'docs-drift': ['**/*.{ts,tsx,js,mjs,md}'],
    'style-drift': [...cfg.sourceGlobs, '**/*.css'],
  }[name] ?? cfg.sourceGlobs;
  const read = (p) => ({ path: p, text: readFileSync(join(config.root, p), 'utf8') });
  const files = tracked
    .filter((p) => matchesAny(p, globs) && !matchesAny(p, cfg.ignoreGlobs))
    .filter((p) => existsSync(join(config.root, p)))
    .map(read);
  for (const t of cfg.tokenFiles) if (!files.some((f) => f.path === t) && existsSync(join(config.root, t))) files.push(read(t));
  const opt = (p) => (p && existsSync(join(config.root, p)) ? readFileSync(join(config.root, p), 'utf8') : '');

  const flags = audit.scan({ files, cfg, envExample: opt(cfg.envExample), rules: opt(cfg.rulesDoc) });
  const limit = Number(args.flags.limit ?? 60);
  console.log(`Audit ${name}: ${flags.length} flag(s) over ${files.length} file(s).`);
  console.log(`Model pass question: ${audit.focus}\n`);
  for (const f of flags.slice(0, limit)) console.log(`- ${f.path}${f.line ? `:${f.line}` : ''} — ${f.note}`);
  if (flags.length > limit) console.log(`- … ${flags.length - limit} more (--limit)`);
  return 0;
}
