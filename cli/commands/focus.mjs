// melon focus: which files of a PR deserve a deep review, and their diff alone. The rest of the
// PR gets a skim, so an H review costs depth only where a break would be systemic.
import { getPr, getPrFiles } from '../lib/github.mjs';
import { codeChurn, focusFiles, requiredTier } from '../lib/rules.mjs';
import { git, tryRun } from '../lib/sh.mjs';

export const help = `melon focus <pr> [--diff]
  Lists the PR's focus files (systemic paths, edits to rule docs, held hotspots) with their
  changed lines, and the rest as a one-line summary.
  --diff  print the diff of the focus files only (against the merge base with main)`;

export function main(args, config) {
  const number = args.positional[0];
  if (!number) {
    console.log(help);
    return 2;
  }
  const pr = getPr(number);
  const files = getPrFiles(number);
  const focus = focusFiles(files, config.tiers, config.hotspots);
  const { tier } = requiredTier(files, config.tiers);
  const rest = files.filter((f) => !focus.some((x) => x.path === f.path));

  console.log(`#${number}: ${files.length} files; the change alone needs tier:${tier}.`);
  if (focus.length === 0) {
    console.log('No focus files: review the whole diff at normal depth.');
  } else {
    console.log(`Focus (${focus.length}; read in depth):`);
    for (const f of focus) console.log(`- ${f.path} (${f.churn} lines; ${f.why})`);
  }
  console.log(`Skim (${rest.length} files, ${codeChurn(rest, config.tiers.churnIgnore)} code lines): ${rest.slice(0, 8).map((f) => f.path).join(', ')}${rest.length > 8 ? ', …' : ''}`);

  if (args.flags.diff && focus.length) {
    const main = config.mainBranch;
    const fetched = tryRun('git', ['fetch', '-q', 'origin', main, `+refs/pull/${number}/head:refs/melon/pr-${number}`], { cwd: config.root });
    if (fetched.status !== 0) throw new Error(fetched.stderr);
    console.log('');
    console.log(git(['diff', `origin/${main}...${pr.headRefOid}`, '--', ...focus.map((f) => f.path)], { cwd: config.root }));
  }
  return 0;
}
