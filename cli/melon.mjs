#!/usr/bin/env node
// melon: the scripted half of melon-stack. Node 22, no dependencies; shells out to git and gh.
import { loadConfig } from './lib/config.mjs';

const COMMANDS = ['check', 'gate', 'focus', 'merge', 'ledger', 'escapes', 'records', 'status', 'batch', 'labels', 'audit', 'init'];
const NO_CONFIG = new Set(['init']);

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      positional.push(a);
      continue;
    }
    const [key, inline] = a.slice(2).split(/=(.*)/s);
    if (inline !== undefined) flags[key] = inline;
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') && VALUE_FLAGS.has(key)) flags[key] = argv[++i];
    else flags[key] = true;
  }
  return { positional, flags };
}

const VALUE_FLAGS = new Set(['record', 'ledger', 'area', 'min', 'limit', 'to', 'projects', 'since', 'until', 'settle']);

async function cli(argv) {
  const [name, ...rest] = argv;
  if (!name || name === 'help' || name === '--help' || !COMMANDS.includes(name)) {
    console.log(`melon <command> [--help]\nCommands: ${COMMANDS.join(', ')}`);
    return name && !['help', '--help'].includes(name) ? 2 : 0;
  }
  const mod = await import(`./commands/${name}.mjs`);
  const args = parseArgs(rest);
  if (args.flags.help) {
    console.log(mod.help);
    return 0;
  }
  const config = NO_CONFIG.has(name) ? null : loadConfig();
  return mod.main(args, config);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('melon.mjs')) {
  cli(process.argv.slice(2)).then(
    (code) => process.exit(code ?? 0),
    (err) => {
      console.error(err.message);
      process.exit(1);
    },
  );
}
