// GitHub reads shared by gate, merge, status and batch. Everything goes through the `gh` CLI.
import { gh, ghApiList, ghJson } from './sh.mjs';

const PR_FIELDS = [
  'number',
  'title',
  'body',
  'labels',
  'headRefName',
  'headRefOid',
  'baseRefName',
  'isDraft',
  'state',
  'comments',
  'statusCheckRollup',
  'updatedAt',
  'url',
].join(',');

const labelNames = (labels) => (labels ?? []).map((l) => l.name);

export function getPr(number) {
  const pr = ghJson(['pr', 'view', String(number), '--json', PR_FIELDS]);
  return { ...pr, labels: labelNames(pr.labels), comments: pr.comments ?? [] };
}

/** Per-file status, additions, deletions and patch (REST; `gh pr view` has no status). */
export function getPrFiles(number) {
  return ghApiList(`repos/{owner}/{repo}/pulls/${number}/files?per_page=100`).map((f) => ({
    path: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }));
}

export function listOpenPrs() {
  return ghJson([
    'pr',
    'list',
    '--state',
    'open',
    '--limit',
    '100',
    '--json',
    'number,title,labels,isDraft,headRefName,updatedAt,url',
  ]).map((p) => ({ ...p, labels: labelNames(p.labels) }));
}

export function listOpenIssues(label) {
  const args = ['issue', 'list', '--state', 'open', '--limit', '300', '--json', 'number,title,labels,updatedAt'];
  if (label) args.push('--label', label);
  return ghJson(args).map((i) => ({ ...i, labels: labelNames(i.labels) }));
}

export function getIssueComments(number) {
  return ghJson(['issue', 'view', String(number), '--json', 'comments']).comments ?? [];
}

export function comment(kind, number, body) {
  gh([kind, 'comment', String(number), '--body', body]);
}

/** Overall CI state for a PR head: 'success' | 'pending' | 'failure' | 'none'. */
export function ciState(rollup) {
  const runs = rollup ?? [];
  if (runs.length === 0) return 'none';
  const states = runs.map((r) => (r.__typename === 'StatusContext' ? r.state : r.conclusion || r.status));
  if (states.some((s) => ['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE'].includes(s))) {
    return 'failure';
  }
  if (states.every((s) => ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(s))) return 'success';
  return 'pending';
}
