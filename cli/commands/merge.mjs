// melon merge: gate → CI per tier → squash merge → daily-log line → S-batch CI on main.
// The person or agent running it makes no quality judgment; the gate and CI do.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { ciState, comment, getIssue, getPr } from '../lib/github.mjs';
import { causedBy, closedIssues, impactSummary, ledgerLine as bodyLedger, localDate, tierFromLabels } from '../lib/rules.mjs';
import { gh, ghJson, git, tryRun } from '../lib/sh.mjs';
import { decisionEntries, graduations, record, removeEntries } from '../lib/records.mjs';
import { evaluate } from './gate.mjs';
import { readDecisionLog, updateRecord } from './records.mjs';
import { ledgerFor, ledgerLine } from './ledger.mjs';

/** The measured ledger from transcripts; never blocks a merge. */
function measuredLedger(number, config) {
  try {
    return ledgerLine(ledgerFor(number, config));
  } catch (err) {
    return `ledger unavailable: ${err.message.split('\n')[0]}`;
  }
}

/** " · fixes an escape from #12 (tier:m)" for each closed issue with a "Caused by: #n" line. */
function escapeTags(body) {
  const tags = [];
  for (const n of closedIssues(body)) {
    let causes = [];
    try {
      causes = causedBy(getIssue(n, 'body').body);
    } catch {
      continue;
    }
    for (const p of causes) {
      let tier = '?';
      try {
        tier = tierFromLabels(getPr(p).labels).tier ?? '?';
      } catch {
        // not a PR in this repo; keep the number
      }
      tags.push(` · fixes an escape from #${p} (tier:${tier})`);
    }
  }
  return tags.join('');
}

/** After the merge, the PR's graduated decisions leave the decision log. Never fails the merge. */
function graduate(pr, config) {
  const ids = [...graduations(pr.body).keys()];
  if (!ids.length) return;
  const dl = readDecisionLog(config);
  if (dl.error) return console.log(`Decision log not updated (${dl.error}); remove ${ids.join(', ')} by hand.`);
  const present = ids.filter((id) => dl.entries.some((e) => e.id === id));
  if (!present.length) return console.log(`Decision log ${dl.where}: nothing to remove for ${ids.join(', ')}.`);
  if (!dl.issue) return console.log(`Decision log ${dl.where}: remove ${present.join(', ')} (graduated in #${pr.number}).`);
  // Removed from a fresh read and checked after, so a decision another role added meanwhile survives.
  const gone = (body) => !decisionEntries(body).some((e) => present.includes(e.id));
  try {
    const r = updateRecord(config, 'decisionLog', (body) => ({ body: removeEntries(body, present), check: gone }));
    if (r.error) throw new Error(r.error);
    console.log(`Decision log ${dl.where}: ${present.join(', ')} graduated and removed.`);
  } catch (err) {
    console.log(`Decision log ${dl.where} not updated (${err.message.split('\n')[0]}); remove ${present.join(', ')} by hand.`);
  }
}

export const help = `melon merge <pr> [--ledger "<text>"] [--dry-run]
  1. Runs melon gate; stops on any failure.
  2. M/H: needs a head that contains main and green CI on it. A draft is marked ready (which
     starts CI) and melon merge exits 3 ("run again when CI finishes"). A red run sends the PR
     back to draft and exits 1.
     A ready PR with no run on its head (main was merged in) gets CI dispatched; exit 3.
     S: no PR CI; the recorded melon check stands in.
  3. Squash-merges (title + " (#n)"), pinned to the gated head, and deletes the remote branch
     (a failure there is a warning; the local branch stays for the orchestrator's worktree cleanup).
  4. Adds "- #n <Impact first sentence> (<ledger>)" to today's daily log (records.dailyLog), creating it
     (and closing older ones) when needed. A closed issue with "Caused by: #p" adds
     " · fixes an escape from #p (tier:x)" (melon escapes counts them).
  5. Removes the PR's graduated decisions ("D<n> → …" under Decisions) from the decision log
     when it's an issue; a file log is listed for the orchestrator to edit.
  6. After ci.batchAfterSMerges S merges since the last CI that covered main, dispatches CI on
     main. An M/H merge resets the count, because its CI ran on a head containing main.
  S: CI runs as for M when the recorded melon check lists checks that couldn't run locally.
  Run it again on a PR that's already merged to finish what an interrupted run skipped: steps
  4–6 run unless the daily log already has the PR's line.
  --ledger   the ledger text; otherwise a "Ledger:" line in the PR body, otherwise the measured
             ledger from session transcripts (melon ledger <pr> --line)
  --dry-run  stop before merging and print what would happen
Exit codes: 0 merged, 1 blocked, 3 waiting for CI.`;

function statePath(config) {
  const common = git(['rev-parse', '--git-common-dir'], { cwd: config.root });
  return join(isAbsolute(common) ? common : join(config.root, common), 'melon-state.json');
}

function readState(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { sMergesSinceMainCi: 0 };
}

/** The daily-log issue that already has a line for #n, if any (recent logs, open or closed). */
function loggedOn(config, number) {
  const { label } = record(config, 'dailyLog');
  const logs = ghJson(['issue', 'list', '--state', 'all', '--label', label, '--json', 'number,comments', '--limit', '7']) ?? [];
  return logs.find((i) => (i.comments ?? []).some((c) => (c.body ?? '').startsWith(`- #${number} `)))?.number ?? null;
}

/** Deletes the PR's branch on origin only; never fails the merge. */
function deleteRemoteBranch(branch, config) {
  if (!branch) return;
  const there = tryRun('git', ['ls-remote', '--exit-code', '--heads', 'origin', branch], { cwd: config.root });
  if (there.status !== 0) return;
  const r = tryRun('git', ['push', '-q', 'origin', '--delete', branch], { cwd: config.root });
  if (r.status !== 0) console.log(`! Branch ${branch} not deleted on origin (${r.stderr.split('\n')[0]}); delete it by hand.`);
}

function logLine(number, pr, args, config) {
  const summary = impactSummary(pr.body, config.pr.impactLabel) ?? pr.title;
  const ledger = args.flags.ledger ?? bodyLedger(pr.body) ?? measuredLedger(number, config);
  return `- #${number} ${summary} (${ledger})${escapeTags(pr.body)}`;
}

/** Steps 4–6, after the squash-merge. Each is safe to run again. */
function afterMerge(number, pr, { tier, ciRan, line, resumed }, config) {
  deleteRemoteBranch(pr.headRefName, config);
  const already = resumed ? loggedOn(config, number) : null;
  if (already) {
    console.log(`Already logged on #${already}.`);
  } else {
    console.log(`Logged on #${dailyLog(config, line)}.`);
  }
  graduate(pr, config);
  if (already) return 0; // the S-merge count was taken with the log line

  const file = statePath(config);
  const state = readState(file);
  if (ciRan) {
    state.sMergesSinceMainCi = 0;
  } else {
    state.sMergesSinceMainCi += 1;
    if (state.sMergesSinceMainCi >= config.ci.batchAfterSMerges) {
      gh(['workflow', 'run', config.ci.workflow, '--ref', config.mainBranch]);
      console.log(`Dispatched CI on ${config.mainBranch} after ${state.sMergesSinceMainCi} S merges. If it fails, revert the suspect merge.`);
      state.sMergesSinceMainCi = 0;
    } else {
      console.log(`S merges since CI covered ${config.mainBranch}: ${state.sMergesSinceMainCi}/${config.ci.batchAfterSMerges}.`);
    }
  }
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
  console.log(`Done: #${number} (tier:${tier}).`);
  return 0;
}

function dailyLog(config, line) {
  const { label, titlePrefix } = record(config, 'dailyLog');
  const title = `${titlePrefix}${localDate(new Date(), config.timeZone)}`;
  const open = ghJson(['issue', 'list', '--state', 'open', '--label', label, '--json', 'number,title', '--limit', '50']);
  let today = open.find((i) => i.title === title);
  if (!today) {
    const url = gh(['issue', 'create', '--title', title, '--label', label, '--body', `Merges on ${title.slice(titlePrefix.length)} (${config.timeZone}). One comment per merge.`]);
    today = { number: Number(url.split('/').pop()), title };
  }
  for (const old of open.filter((i) => i.number !== today.number)) gh(['issue', 'close', String(old.number)]);
  comment('issue', today.number, `${line}\n\n${config.signature}`);
  return today.number;
}

export function main(args, config) {
  const number = args.positional[0];
  if (!number) {
    console.log(help);
    return 2;
  }
  // Already merged (an earlier run stopped part-way): finish steps 4–6 instead of failing the gate.
  const current = getPr(number);
  if (current.state === 'MERGED') {
    const tier = tierFromLabels(current.labels).tier ?? 's';
    if (args.flags['dry-run']) {
      console.log(`Dry run: #${number} is merged; would finish logging and graduation.`);
      return 0;
    }
    console.log(`#${number} is already merged; finishing the steps after the merge.`);
    return afterMerge(number, current, { tier, ciRan: config.ci.requiredFor.includes(tier), line: logLine(number, current, args, config), resumed: true }, config);
  }

  const gate = evaluate(number, config);
  for (const x of gate.results.filter((r) => !r.ok || r.warn)) console.log(`${x.ok ? '!' : '✗'} ${x.name} — ${x.detail}`);
  if (!gate.ok) {
    console.log(`Blocked: gate failed for #${number}. Run \`melon gate ${number}\` for the full list.`);
    return 1;
  }
  const { pr, tier } = gate;
  const main = config.mainBranch;
  const needsCi = config.ci.requiredFor.includes(tier) || gate.ciNeeded;

  if (needsCi) {
    const upToDate = tryRun('git', ['merge-base', '--is-ancestor', `origin/${main}`, pr.headRefOid], { cwd: config.root }).status === 0;
    if (!upToDate) {
      console.log(`Blocked: #${number} doesn't contain the latest ${main}. In its worktree: git merge origin/${main}, push, then run again.`);
      return 1;
    }
    if (pr.isDraft) {
      if (args.flags['dry-run']) {
        console.log(`Dry run: would mark #${number} ready (starts CI) and wait.`);
        return 3;
      }
      gh(['pr', 'ready', String(number)]);
      console.log(`Marked #${number} ready; CI starts on ${pr.headRefOid.slice(0, 9)}. Run \`melon merge ${number}\` again when it finishes.`);
      return 3;
    }
    const ci = ciState(pr.statusCheckRollup);
    if (ci === 'none') {
      // A ready PR gets no new run on push (CI fires on ready_for_review), e.g. after merging main in.
      if (args.flags['dry-run']) {
        console.log(`Dry run: would dispatch ${config.ci.workflow} on ${pr.headRefName} and wait.`);
        return 3;
      }
      gh(['workflow', 'run', config.ci.workflow, '--ref', pr.headRefName]);
      console.log(`Dispatched CI on ${pr.headRefName} @ ${pr.headRefOid.slice(0, 9)}. Run \`melon merge ${number}\` again when it finishes.`);
      return 3;
    }
    if (ci === 'pending') {
      console.log(`CI is still running on ${pr.headRefOid.slice(0, 9)}. Run again when it finishes.`);
      return 3;
    }
    if (ci === 'failure') {
      if (!args.flags['dry-run']) gh(['pr', 'ready', String(number), '--undo']);
      console.log(`Blocked: CI failed on #${number}; it is back in draft for the builder.`);
      return 1;
    }
  } else if (pr.isDraft && !args.flags['dry-run']) {
    // GitHub can't merge drafts. S-tier CI workflows skip `tier:s` (see examples/ci-path-filters.md).
    gh(['pr', 'ready', String(number)]);
  }

  const line = logLine(number, pr, args, config);

  if (args.flags['dry-run']) {
    console.log(`Dry run: would squash-merge #${number} (tier:${tier}) at ${pr.headRefOid.slice(0, 9)} and log:\n${line}`);
    return 0;
  }

  gh(['pr', 'merge', String(number), '--squash', '--match-head-commit', pr.headRefOid, '--subject', `${pr.title} (#${number})`]);
  console.log(`Merged #${number} (tier:${tier}).`);
  return afterMerge(number, pr, { tier, ciRan: needsCi, line, resumed: false }, config);
}
