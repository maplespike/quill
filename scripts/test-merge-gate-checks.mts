/**
 * Regression for merge-gate check identity and REST pull metadata.
 *
 * PR 1325 head cc4596fab7fefa5530a036097cb94afd5429e272 kept a cancelled
 * "PR checks" run beside a later success of the same workflow on the same
 * SHA. The old counter treated every non-stale run as current, so red was 1.
 * PR 1326 run 42959473763 exited 0 after five reads because GraphQL
 * headRepository was empty. REST head.repo null must stay unknown, not a
 * foreign repository.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = path.join(REPO, '.github/workflows/merge-when-green.yml');
const SELECT = path.join(REPO, 'scripts/gates/select-merge-checks.jq');
const NORMALIZE = path.join(REPO, 'scripts/gates/normalize-pull.jq');
const PATH_PR = '.github/workflows/pr-validation.yml';
const PATH_CI = '.github/workflows/ci.yml';

const workflow = () => fs.readFileSync(WORKFLOW, 'utf8');

function embedded(source: string, fileName: string): string {
  const begin = `# BEGIN ${fileName}`;
  const end = `# END ${fileName}`;
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line.includes(begin));
  const stop = lines.findIndex((line, index) => index >= start && line.includes(end));
  assert.ok(start >= 0 && stop > start, `${fileName} markers missing`);
  const block = lines.slice(start, stop + 1);
  const indent = block[0].match(/^ */)?.[0].length ?? 0;
  return block.map((line) => line.slice(indent)).join('\n') + '\n';
}

interface CheckInput {
  id: number;
  name: string;
  conclusion: string | null;
  started: string;
  run: number | null;
  app?: number | null;
  sha?: string;
  status?: string;
  external?: string | null;
  suite?: number | null;
  slug?: string | null;
  details?: string | null;
  html?: string | null;
}

function check(input: CheckInput) {
  const app = input.app === undefined ? 15368 : input.app;
  const slug = input.slug === undefined ? 'github-actions' : input.slug;
  const suite = input.suite === undefined ? 1 : input.suite;
  const external = input.external === undefined ? `ext-${input.id}` : input.external;
  const details = input.details === undefined
    ? (input.run == null
      ? `https://example.test/${input.id}`
      : `https://github.com/maplespike/quill/actions/runs/${input.run}/job/${input.id}`)
    : input.details;
  return {
    id: input.id,
    name: input.name,
    status: input.status ?? 'completed',
    conclusion: input.conclusion,
    started_at: input.started,
    completed_at: input.started,
    head_sha: input.sha ?? 'sha1',
    external_id: external,
    details_url: details,
    html_url: input.html ?? details,
    app: app == null ? null : { id: app, slug },
    check_suite: suite == null ? null : { id: suite },
  };
}

function runMeta(id: number, workflowPath: string, started: string, attempt = 1, sha = 'sha1') {
  return { id, path: workflowPath, run_started_at: started, run_attempt: attempt, head_sha: sha };
}

function page(items: unknown[], key: string, total = items.length) {
  return { total_count: total, [key]: items };
}

interface SelectResult {
  ok: boolean;
  error: string;
  checks: { pending: number; red: number; green: number; pending_names: string; red_names: string };
  statuses: { pending: number; red: number; green: number; pending_names: string; red_names: string };
}

function statusPage(body: unknown, next: string | null = null, httpStatus = 200) {
  return { http_status: httpStatus, next, body };
}

function statusDocuments(statuses: unknown): unknown[] {
  if (Array.isArray(statuses) && statuses.length > 0 && statuses.every((item) => item && typeof item === 'object' && 'http_status' in (item as object))) {
    return statuses;
  }
  if (Array.isArray(statuses) && statuses.length > 0 && statuses.every(Array.isArray)) {
    const pages = statuses as unknown[][];
    return pages.map((body, index) => statusPage(
      body,
      index < pages.length - 1
        ? `https://api.github.com/repos/maplespike/quill/commits/sha1/statuses?per_page=100&page=${index + 2}`
        : null,
    ));
  }
  if (Array.isArray(statuses)) return [statusPage(statuses)];
  return [statusPage([])];
}

function writePages(file: string, pages: unknown) {
  const list = Array.isArray(pages) ? pages : [pages];
  fs.writeFileSync(file, list.map((item) => JSON.stringify(item)).join('\n'));
}

function select(
  checks: unknown,
  runs: unknown,
  statuses: unknown,
  required: unknown[] = [],
  head = 'sha1',
  runId = '424242',
): SelectResult {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  const checksFile = path.join(dir, 'checks.json');
  const runsFile = path.join(dir, 'runs.json');
  const statusFile = path.join(dir, 'statuses.json');
  writePages(checksFile, checks);
  writePages(runsFile, runs);
  writePages(statusFile, statusDocuments(statuses));
  const out = execFileSync('jq', [
    '-n',
    '--arg', 'head_sha', head,
    '--arg', 'job', 'merge',
    '--arg', 'workflow', 'Merge when green',
    '--arg', 'workflow_path', '.github/workflows/merge-when-green.yml',
    '--arg', 'run_id', runId,
    '--arg', 'app_slug', 'github-actions',
    '--argjson', 'required', JSON.stringify(required),
    '--slurpfile', 'check_pages', checksFile,
    '--slurpfile', 'run_pages', runsFile,
    '--slurpfile', 'status_pages', statusFile,
    '-f', SELECT,
  ], { encoding: 'utf8' });
  return JSON.parse(out) as SelectResult;
}

function normalize(pull: unknown) {
  return JSON.parse(execFileSync('jq', ['-f', NORMALIZE], {
    encoding: 'utf8',
    input: JSON.stringify(pull),
  })) as { headRepo: string; mergeable: string; state: string; author: { login: string } };
}

test('the workflow embeds the check selector and the pull normalizer', () => {
  const text = workflow();
  assert.equal(embedded(text, 'select-merge-checks.jq'), fs.readFileSync(SELECT, 'utf8'));
  assert.equal(embedded(text, 'normalize-pull.jq'), fs.readFileSync(NORMALIZE, 'utf8'));
});

test('REST head.repo null stays unknown and a present full_name is kept', () => {
  const missing = normalize({
    state: 'open',
    draft: false,
    mergeable: true,
    mergeable_state: 'clean',
    head: { sha: 'abc', repo: null },
    user: { login: 'reverb256' },
    labels: [],
    body: '',
    headRepository: { nameWithOwner: 'maplespike/quill' },
  });
  assert.equal(missing.headRepo, '');
  assert.equal(missing.mergeable, 'MERGEABLE');
  assert.equal(missing.state, 'OPEN');

  const present = normalize({
    state: 'open',
    draft: false,
    mergeable: null,
    mergeable_state: 'unknown',
    head: { sha: 'abc', repo: { full_name: 'other/fork' } },
    user: null,
    labels: [{ name: 'ready-to-merge' }],
    body: null,
  });
  assert.equal(present.headRepo, 'other/fork');
  assert.equal(present.mergeable, 'UNKNOWN');
  assert.equal(present.author.login, '');
});

test('a cancelled predecessor does not outvote a later success on the same SHA', () => {
  const result = select(
    page([
      check({ id: 1, name: 'PR checks', conclusion: 'cancelled', started: '2026-11-11T03:29:26Z', run: 10, external: 'a' }),
      check({ id: 2, name: 'PR checks', conclusion: 'success', started: '2026-11-11T03:40:36Z', run: 11, external: 'b' }),
      check({ id: 3, name: 'merge', conclusion: 'cancelled', started: '2026-11-11T03:29:21Z', run: 9, external: 'c' }),
      check({ id: 4, name: 'audit', conclusion: 'success', started: '2026-11-11T03:43:01Z', run: 12, external: 'd' }),
      check({ id: 5, name: 'audit', conclusion: 'success', started: '2026-11-11T04:27:37Z', run: 13, external: 'e' }),
    ], 'check_runs'),
    page([
      runMeta(10, PATH_PR, '2026-11-11T03:29:21Z'),
      runMeta(11, PATH_PR, '2026-11-11T03:29:28Z'),
      runMeta(9, '.github/workflows/merge-when-green.yml', '2026-11-11T03:29:20Z'),
      runMeta(12, '.github/workflows/open-source-audit.yml', '2026-11-11T03:29:21Z'),
      runMeta(13, PATH_CI, '2026-11-11T03:29:21Z'),
    ], 'workflow_runs'),
    [],
  );
  assert.equal(result.ok, true);
  assert.equal(result.checks.red, 0);
  assert.equal(result.checks.green, 3);
});

test('a newer failure beats an older success, including a higher check id on the old run', () => {
  const result = select(
    page([
      check({ id: 50, name: 'PR checks', conclusion: 'success', started: '2026-11-11T05:00:00Z', run: 2 }),
      check({ id: 10, name: 'PR checks', conclusion: 'failure', started: '2026-11-11T04:00:00Z', run: 3 }),
    ], 'check_runs'),
    page([
      runMeta(2, PATH_PR, '2026-11-11T03:00:00Z'),
      runMeta(3, PATH_PR, '2026-11-11T04:00:00Z'),
    ], 'workflow_runs'),
    [],
  );
  assert.equal(result.checks.red, 1);
  assert.equal(result.checks.green, 0);
});

test('a newer pending run beats an older success', () => {
  const result = select(
    page([
      check({ id: 1, name: 'build', conclusion: 'success', started: '2026-11-11T03:00:00Z', run: 1 }),
      check({ id: 2, name: 'build', conclusion: null, started: '2026-11-11T04:00:00Z', run: 2, status: 'in_progress' }),
    ], 'check_runs'),
    page([
      runMeta(1, PATH_CI, '2026-11-11T03:00:00Z'),
      runMeta(2, PATH_CI, '2026-11-11T04:00:00Z'),
    ], 'workflow_runs'),
    [],
  );
  assert.equal(result.checks.pending, 1);
  assert.equal(result.checks.green, 0);
  assert.equal(result.checks.red, 0);
});

test('an active pending check blocks on its own', () => {
  const result = select(
    page([check({ id: 1, name: 'build', conclusion: null, started: '2026-11-11T04:00:00Z', run: 1, status: 'queued' })], 'check_runs'),
    page([runMeta(1, PATH_CI, '2026-11-11T04:00:00Z')], 'workflow_runs'),
    [],
  );
  assert.equal(result.checks.pending, 1);
  assert.equal(result.checks.green, 0);
});

test('same-SHA reruns keep the later attempt inside one workflow run', () => {
  const failure = select(
    page([
      check({ id: 1, name: 'build', conclusion: 'success', started: 't1', run: 5 }),
      check({ id: 2, name: 'build', conclusion: 'failure', started: 't2', run: 5 }),
    ], 'check_runs'),
    page([runMeta(5, PATH_CI, '2026-11-11T04:00:00Z', 2)], 'workflow_runs'),
    [],
  );
  assert.equal(failure.checks.red, 1);
  assert.equal(failure.checks.green, 0);

  const success = select(
    page([
      check({ id: 1, name: 'PR checks', conclusion: 'cancelled', started: 't1', run: 5 }),
      check({ id: 2, name: 'PR checks', conclusion: 'success', started: 't2', run: 5 }),
    ], 'check_runs'),
    page([runMeta(5, PATH_PR, '2026-11-11T04:00:00Z', 2)], 'workflow_runs'),
    [],
  );
  assert.equal(success.checks.red, 0);
  assert.equal(success.checks.green, 1);
});

test('a cancelled run with no later attempt stays red', () => {
  const result = select(
    page([check({ id: 1, name: 'PR checks', conclusion: 'cancelled', started: 't', run: 5 })], 'check_runs'),
    page([runMeta(5, PATH_PR, 't')], 'workflow_runs'),
    [],
  );
  assert.equal(result.checks.red, 1);
  assert.equal(result.checks.green, 0);
});

test('the same job name in two workflows stays two checks', () => {
  const result = select(
    page([
      check({ id: 1, name: 'audit', conclusion: 'failure', started: 't1', run: 1 }),
      check({ id: 2, name: 'audit', conclusion: 'success', started: 't2', run: 2 }),
    ], 'check_runs'),
    page([
      runMeta(1, '.github/workflows/open-source-audit.yml', '2026-11-11T03:00:00Z'),
      runMeta(2, PATH_CI, '2026-11-11T04:00:00Z'),
    ], 'workflow_runs'),
    [],
  );
  assert.equal(result.checks.red, 1);
  assert.equal(result.checks.green, 1);
});

test('two providers that share a friendly name both count', () => {
  const result = select(
    page([
      check({ id: 1, name: 'build', conclusion: 'failure', started: 't1', run: null, app: 10, slug: 'codecov', external: 'stable-a', suite: null }),
      check({ id: 2, name: 'build', conclusion: 'success', started: 't2', run: null, app: 11, slug: 'other', external: 'stable-b', suite: null }),
    ], 'check_runs'),
    page([], 'workflow_runs'),
    [],
  );
  assert.equal(result.checks.red, 1);
  assert.equal(result.checks.green, 1);
});

test('a non-Actions external id collapses only a real rerun', () => {
  const rerun = select(
    page([
      check({ id: 1, name: 'lint', conclusion: 'cancelled', started: '2026-11-11T03:00:00Z', run: null, app: 10, slug: 'codecov', external: 'same', suite: null }),
      check({ id: 2, name: 'lint', conclusion: 'success', started: '2026-11-11T04:00:00Z', run: null, app: 10, slug: 'codecov', external: 'same', suite: null }),
    ], 'check_runs'),
    page([], 'workflow_runs'),
    [],
  );
  assert.equal(rerun.checks.red, 0);
  assert.equal(rerun.checks.green, 1);

  const distinct = select(
    page([
      check({ id: 1, name: 'lint', conclusion: 'cancelled', started: 't', run: null, app: 10, slug: 'codecov', external: 'one', suite: null }),
      check({ id: 2, name: 'lint', conclusion: 'success', started: 't', run: null, app: 10, slug: 'codecov', external: 'two', suite: null }),
    ], 'check_runs'),
    page([], 'workflow_runs'),
    [],
  );
  assert.equal(distinct.checks.red, 1);
  assert.equal(distinct.checks.green, 1);

  const newerFailure = select(
    page([
      check({ id: 9, name: 'lint', conclusion: 'success', started: '2026-11-11T03:00:00Z', run: null, app: 10, slug: 'codecov', external: 'same', suite: null }),
      check({ id: 2, name: 'lint', conclusion: 'failure', started: '2026-11-11T04:00:00Z', run: null, app: 10, slug: 'codecov', external: 'same', suite: null }),
    ], 'check_runs'),
    page([], 'workflow_runs'),
    [],
  );
  assert.equal(newerFailure.checks.red, 1);
  assert.equal(newerFailure.checks.green, 0);
});

test('pagination keeps a success that arrives on the second page', () => {
  const result = select(
    [
      page([check({ id: 1, name: 'PR checks', conclusion: 'cancelled', started: '2026-11-11T03:00:00Z', run: 1 })], 'check_runs', 2),
      page([check({ id: 2, name: 'PR checks', conclusion: 'success', started: '2026-11-11T04:00:00Z', run: 2 })], 'check_runs', 2),
    ],
    page([
      runMeta(1, PATH_PR, '2026-11-11T03:00:00Z'),
      runMeta(2, PATH_PR, '2026-11-11T04:00:00Z'),
    ], 'workflow_runs'),
    [],
  );
  assert.equal(result.ok, true);
  assert.equal(result.checks.red, 0);
  assert.equal(result.checks.green, 1);
});

test('an incomplete page, a permission error, and missing metadata fail closed', () => {
  const incomplete = select(
    page([check({ id: 1, name: 'PR checks', conclusion: 'success', started: 't', run: 1 })], 'check_runs', 3),
    page([runMeta(1, PATH_PR, 't')], 'workflow_runs'),
    [],
  );
  assert.equal(incomplete.ok, false);
  assert.match(incomplete.error, /incomplete/);
  assert.equal(incomplete.checks.green, 0);

  const denied = select(
    { message: 'Resource not accessible by integration', status: '403' },
    page([], 'workflow_runs'),
    [],
  );
  assert.equal(denied.ok, false);
  assert.match(denied.error, /Resource not accessible/);
  assert.equal(denied.checks.red, 0);

  const noApp = check({ id: 1, name: 'build', conclusion: 'success', started: 't', run: 1 });
  noApp.app = null;
  const missingApp = select(page([noApp], 'check_runs'), page([runMeta(1, PATH_CI, 't')], 'workflow_runs'), []);
  assert.equal(missingApp.ok, false);
  assert.match(missingApp.error, /app\.id/);

  const missingRun = select(
    page([check({ id: 1, name: 'build', conclusion: 'success', started: 't', run: 99 })], 'check_runs'),
    page([], 'workflow_runs'),
    [],
  );
  assert.equal(missingRun.ok, false);
  assert.match(missingRun.error, /workflow metadata/);

  const noSha = check({ id: 1, name: 'build', conclusion: 'success', started: 't', run: 1, sha: '' });
  const missingSha = select(page([noSha], 'check_runs'), page([runMeta(1, PATH_CI, 't')], 'workflow_runs'), []);
  assert.equal(missingSha.ok, false);
  assert.match(missingSha.error, /head_sha/);

  const badPath = runMeta(1, PATH_CI, 't');
  badPath.path = '';
  const missingPath = select(page([], 'check_runs'), page([badPath], 'workflow_runs'), []);
  assert.equal(missingPath.ok, false);
  assert.match(missingPath.error, /path/);
});

test('a check or status from another SHA cannot make this SHA green or red', () => {
  const result = select(
    page([
      check({ id: 1, name: 'build', conclusion: 'failure', started: 't', run: 1, sha: 'other' }),
      check({ id: 2, name: 'build', conclusion: 'success', started: 't', run: 2 }),
    ], 'check_runs'),
    page([
      runMeta(1, PATH_CI, 't', 1, 'other'),
      runMeta(2, PATH_CI, 't'),
    ], 'workflow_runs'),
    [
      { id: 1, context: 'ci/test', state: 'success', updated_at: '2026-11-11T03:00:00Z', sha: 'sha1' },
      { id: 2, context: 'ci/test', state: 'failure', updated_at: '2026-11-11T04:00:00Z', sha: 'sha1' },
      { id: 3, context: 'ci/other', state: 'success', updated_at: '2026-11-11T05:00:00Z', sha: 'other' },
    ],
  );
  assert.equal(result.ok, true);
  assert.equal(result.checks.red, 0);
  assert.equal(result.checks.green, 1);
  assert.equal(result.statuses.red, 1);
  assert.equal(result.statuses.green, 0);
});

test('commit statuses keep the newest state per context across pages', () => {
  const newerFailure = select(
    page([], 'check_runs'),
    page([], 'workflow_runs'),
    [
      [{ id: 9, context: 'ci/test', state: 'success', updated_at: '2026-11-11T03:00:00Z', sha: 'sha1' }],
      [{ id: 2, context: 'ci/test', state: 'error', updated_at: '2026-11-11T04:00:00Z', sha: 'sha1' }],
    ],
  );
  assert.equal(newerFailure.statuses.red, 1);
  assert.equal(newerFailure.statuses.green, 0);

  const newerSuccess = select(
    page([], 'check_runs'),
    page([], 'workflow_runs'),
    [
      { id: 9, context: 'ci/test', state: 'failure', updated_at: '2026-11-11T03:00:00Z', sha: 'sha1' },
      { id: 2, context: 'ci/test', state: 'success', updated_at: '2026-11-11T04:00:00Z', sha: 'sha1' },
    ],
  );
  assert.equal(newerSuccess.statuses.green, 1);
  assert.equal(newerSuccess.statuses.red, 0);

  const missingContext = select(
    page([], 'check_runs'),
    page([], 'workflow_runs'),
    [{ id: 1, context: '', state: 'success', updated_at: 't', sha: 'sha1' }],
  );
  assert.equal(missingContext.ok, false);
  assert.match(missingContext.error, /context/);

  const unknown = select(
    page([], 'check_runs'),
    page([], 'workflow_runs'),
    [{ id: 1, context: 'ci', state: 'weird', updated_at: 't', sha: 'sha1' }],
  );
  assert.equal(unknown.ok, false);
  assert.match(unknown.error, /unknown state/);
});

test('required checks block when missing or when the latest attempt failed', () => {
  const required = [{ path: PATH_PR, name: 'PR checks' }];
  const missing = select(
    page([check({ id: 2, name: 'build', conclusion: 'success', started: 't', run: 2 })], 'check_runs'),
    page([runMeta(2, PATH_CI, 't')], 'workflow_runs'),
    [],
    required,
  );
  assert.equal(missing.checks.red, 1);
  assert.match(missing.checks.red_names, /missing required/);

  const cancelledThenSuccess = select(
    page([
      check({ id: 1, name: 'PR checks', conclusion: 'cancelled', started: '2026-11-11T03:00:00Z', run: 1 }),
      check({ id: 2, name: 'PR checks', conclusion: 'success', started: '2026-11-11T04:00:00Z', run: 2 }),
    ], 'check_runs'),
    page([
      runMeta(1, PATH_PR, '2026-11-11T03:00:00Z'),
      runMeta(2, PATH_PR, '2026-11-11T04:00:00Z'),
    ], 'workflow_runs'),
    [],
    required,
  );
  assert.equal(cancelledThenSuccess.checks.red, 0);
  assert.equal(cancelledThenSuccess.checks.green, 1);

  const latestFailure = select(
    page([
      check({ id: 1, name: 'PR checks', conclusion: 'success', started: '2026-11-11T03:00:00Z', run: 1 }),
      check({ id: 2, name: 'PR checks', conclusion: 'failure', started: '2026-11-11T04:00:00Z', run: 2 }),
    ], 'check_runs'),
    page([
      runMeta(1, PATH_PR, '2026-11-11T03:00:00Z'),
      runMeta(2, PATH_PR, '2026-11-11T04:00:00Z'),
    ], 'workflow_runs'),
    [],
    required,
  );
  assert.equal(latestFailure.checks.red, 1);
  assert.equal(latestFailure.checks.green, 0);
});

test('the in-progress gate is ignored and a different app named merge is not', () => {
  const current = select(
    page([
      check({ id: 7, name: 'merge', conclusion: null, started: 't', run: 99, status: 'in_progress' }),
      check({ id: 8, name: 'build', conclusion: 'success', started: 't', run: 2 }),
    ], 'check_runs'),
    page([
      runMeta(99, '.github/workflows/merge-when-green.yml', 't'),
      runMeta(2, PATH_CI, 't'),
    ], 'workflow_runs'),
    [],
    [],
    'sha1',
    '99',
  );
  assert.equal(current.checks.pending, 0);
  assert.equal(current.checks.green, 1);

  const alien = select(
    page([
      check({ id: 7, name: 'merge', conclusion: 'failure', started: 't', run: null, app: 99, slug: 'alien', external: 'm', suite: null }),
    ], 'check_runs'),
    page([], 'workflow_runs'),
    [],
  );
  assert.equal(alien.checks.red, 1);
});

const GATE_PATH = '.github/workflows/merge-when-green.yml';

test('a same-app job named merge in another workflow still counts', () => {
  const other = select(
    page([check({ id: 5, name: 'merge', conclusion: 'failure', started: 't', run: 8 })], 'check_runs'),
    page([runMeta(8, PATH_CI, 't')], 'workflow_runs'),
    [],
  );
  assert.equal(other.ok, true);
  assert.equal(other.checks.red, 1);
  assert.equal(other.checks.green, 0);

  const titled = select(
    page([check({ id: 6, name: 'Merge when green', conclusion: 'failure', started: 't', run: 4 })], 'check_runs'),
    page([runMeta(4, '.github/workflows/qa.yml', 't')], 'workflow_runs'),
    [],
  );
  assert.equal(titled.ok, true);
  assert.equal(titled.checks.red, 1);

  const gatePath = select(
    page([check({ id: 3, name: 'merge', conclusion: 'cancelled', started: 't', run: 9 })], 'check_runs'),
    page([runMeta(9, GATE_PATH, 't')], 'workflow_runs'),
    [],
  );
  assert.equal(gatePath.ok, true);
  assert.equal(gatePath.checks.red, 0);
  assert.equal(gatePath.checks.green, 0);
});

test('a merge job with missing workflow or app identity is not dropped', () => {
  const missingPath = select(
    page([check({ id: 5, name: 'merge', conclusion: 'failure', started: 't', run: 55 })], 'check_runs'),
    page([], 'workflow_runs'),
    [],
  );
  assert.equal(missingPath.ok, false);
  assert.match(missingPath.error, /workflow metadata/);
  assert.equal(missingPath.checks.red, 0);
  assert.equal(missingPath.checks.green, 0);

  const noApp = check({ id: 5, name: 'merge', conclusion: 'failure', started: 't', run: 8, app: null });
  const missingApp = select(
    page([noApp], 'check_runs'),
    page([runMeta(8, PATH_CI, 't')], 'workflow_runs'),
    [],
  );
  assert.equal(missingApp.ok, false);
  assert.match(missingApp.error, /app\.id/);
});

test('commit status pages require a finished Link chain', () => {
  const bulk = (count: number, state: string, stamp: string) => Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    context: 'ci/bulk',
    state,
    updated_at: stamp,
    created_at: stamp,
    sha: 'sha1',
  }));
  const fullPage = select(
    page([], 'check_runs'),
    page([], 'workflow_runs'),
    [statusPage(bulk(100, 'success', '2026-11-11T03:00:00Z'), null)],
  );
  assert.equal(fullPage.ok, true);
  assert.equal(fullPage.statuses.green, 1);
  assert.equal(fullPage.statuses.red, 0);

  const unfinished = select(
    page([], 'check_runs'),
    page([], 'workflow_runs'),
    [statusPage(bulk(100, 'success', '2026-11-11T03:00:00Z'), 'https://api.github.com/repositories/1/commits/sha1/statuses?per_page=100&page=2')],
  );
  assert.equal(unfinished.ok, false);
  assert.match(unfinished.error, /next Link remained/);
  assert.equal(unfinished.statuses.green, 0);

  const shortUnfinished = select(
    page([], 'check_runs'),
    page([], 'workflow_runs'),
    [statusPage(bulk(1, 'success', '2026-11-11T03:00:00Z'), 'https://api.github.com/repositories/1/commits/sha1/statuses?page=2')],
  );
  assert.equal(shortUnfinished.ok, false);
  assert.match(shortUnfinished.error, /next Link remained/);

  const linked = select(
    page([], 'check_runs'),
    page([], 'workflow_runs'),
    [
      statusPage(
        [{ id: 1, context: 'ci/test', state: 'success', updated_at: '2026-11-11T03:00:00Z', sha: 'sha1' }],
        'https://api.github.com/repositories/1/commits/sha1/statuses?per_page=100&page=2',
      ),
      statusPage(
        [{ id: 2, context: 'ci/test', state: 'failure', updated_at: '2026-11-11T04:00:00Z', sha: 'sha1' }],
        null,
      ),
    ],
  );
  assert.equal(linked.ok, true);
  assert.equal(linked.statuses.red, 1);
  assert.equal(linked.statuses.green, 0);

  const httpError = select(
    page([], 'check_runs'),
    page([], 'workflow_runs'),
    [statusPage({ message: 'Resource not accessible by integration' }, null, 403)],
  );
  assert.equal(httpError.ok, false);
  assert.match(httpError.error, /HTTP 403/);
  assert.match(httpError.error, /Resource not accessible/);
  assert.equal(httpError.statuses.green, 0);
  assert.equal(httpError.statuses.red, 0);

  const messageBody = select(
    page([], 'check_runs'),
    page([], 'workflow_runs'),
    [statusPage({ message: 'Not Found' }, null, 200)],
  );
  assert.equal(messageBody.ok, false);
  assert.match(messageBody.error, /Not Found/);
  assert.equal(messageBody.statuses.green, 0);

  const afterEnd = select(
    page([], 'check_runs'),
    page([], 'workflow_runs'),
    [
      statusPage([{ id: 1, context: 'ci/test', state: 'success', updated_at: '2026-11-11T03:00:00Z', sha: 'sha1' }], null),
      statusPage([{ id: 2, context: 'ci/test', state: 'failure', updated_at: '2026-11-11T04:00:00Z', sha: 'sha1' }], null),
    ],
  );
  assert.equal(afterEnd.ok, false);
  assert.match(afterEnd.error, /no next Link/);
  assert.equal(afterEnd.statuses.green, 0);

  const empty = select(page([], 'check_runs'), page([], 'workflow_runs'), []);
  assert.equal(empty.ok, true);
  assert.equal(empty.statuses.green, 0);
});

test('a bare status array is not treated as a complete page', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-raw-'));
  const checksFile = path.join(dir, 'checks.json');
  const runsFile = path.join(dir, 'runs.json');
  const statusFile = path.join(dir, 'statuses.json');
  fs.writeFileSync(checksFile, JSON.stringify({ total_count: 0, check_runs: [] }));
  fs.writeFileSync(runsFile, JSON.stringify({ total_count: 0, workflow_runs: [] }));
  fs.writeFileSync(statusFile, JSON.stringify([
    { id: 1, context: 'ci/test', state: 'success', updated_at: '2026-11-11T03:00:00Z', sha: 'sha1' },
  ]));
  const out = execFileSync('jq', [
    '-n',
    '--arg', 'head_sha', 'sha1',
    '--arg', 'job', 'merge',
    '--arg', 'workflow', 'Merge when green',
    '--arg', 'workflow_path', GATE_PATH,
    '--arg', 'run_id', '424242',
    '--arg', 'app_slug', 'github-actions',
    '--argjson', 'required', '[]',
    '--slurpfile', 'check_pages', checksFile,
    '--slurpfile', 'run_pages', runsFile,
    '--slurpfile', 'status_pages', statusFile,
    '-f', SELECT,
  ], { encoding: 'utf8' });
  const result = JSON.parse(out) as SelectResult;
  assert.equal(result.ok, false);
  assert.match(result.error, /Link pagination proof/);
  assert.equal(result.statuses.green, 0);
});

test('status Link pagination fetches every next page and fails closed', () => {
  const text = workflow();
  const begin = '# BEGIN status-paginate.sh';
  const end = '# END status-paginate.sh';
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.includes(begin));
  const stop = lines.findIndex((line, index) => index >= start && line.includes(end));
  assert.ok(start >= 0 && stop > start);
  const block = lines.slice(start + 1, stop);
  const indent = block.find((line) => line.trim())?.match(/^ */)?.[0].length ?? 0;
  const script = block.map((line) => line.slice(indent)).join('\n');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-link-'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  const gh = path.join(bin, 'gh');
  fs.writeFileSync(gh, [
    '#!/bin/bash',
    'url="${@: -1}"',
    'printf \'%s\\n\' "$url" >> "$FIXTURE_LOG"',
    'if [[ "$url" == *page=2* ]]; then',
    '  cat "$FIXTURE_PAGE2"',
    '  exit "${FIXTURE_EXIT2:-0}"',
    'fi',
    'cat "$FIXTURE_PAGE1"',
    'exit "${FIXTURE_EXIT1:-0}"',
    '',
  ].join('\n'));
  fs.chmodSync(gh, 0o755);
  const run = (page1: string, page2 = '', exit1 = 0, exit2 = 0) => {
    const work = fs.mkdtempSync(path.join(dir, 'run-'));
    fs.writeFileSync(path.join(work, 'page1'), page1);
    fs.writeFileSync(path.join(work, 'page2'), page2);
    const log = path.join(work, 'log');
    fs.writeFileSync(log, '');
    let stdout = '';
    try {
      stdout = execFileSync('bash', ['-c', script], {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          GH_REPO: 'maplespike/quill',
          HEAD_SHA: 'sha1',
          READ_TOKEN: 'test-token',
          RUNNER_TEMP: work,
          FIXTURE_PAGE1: path.join(work, 'page1'),
          FIXTURE_PAGE2: path.join(work, 'page2'),
          FIXTURE_LOG: log,
          FIXTURE_EXIT1: String(exit1),
          FIXTURE_EXIT2: String(exit2),
        },
      });
    } catch (error) {
      const failed = error as { stdout?: string; stderr?: string; message: string };
      const pagesPath = path.join(work, 'status-pages.json');
      throw new Error([
        failed.stdout ?? '',
        failed.stderr ?? '',
        failed.message,
        fs.existsSync(pagesPath) ? fs.readFileSync(pagesPath, 'utf8') : '',
      ].join('\n'));
    }
    return {
      stdout,
      pages: fs.readFileSync(path.join(work, 'status-pages.json'), 'utf8'),
      log: fs.readFileSync(log, 'utf8'),
    };
  };
  const one = run('HTTP/2.0 200 OK\nContent-Type: application/json\n\n[]\n');
  const onePage = JSON.parse(one.pages) as { http_status: number; next: string | null; body: unknown[] };
  assert.equal(onePage.http_status, 200);
  assert.equal(onePage.next, null);
  assert.deepEqual(onePage.body, []);
  assert.equal(one.log.trim().split('\n').length, 1);

  const next = 'https://api.github.com/repositories/123/commits/sha1/statuses?per_page=100&page=2';
  const two = run(
    `HTTP/2.0 200 OK\nLink: <${next}>; rel="next", <https://api.github.com/repositories/123/commits/sha1/statuses?per_page=100&page=2>; rel="last"\n\n[{"id":1}]\n`,
    'HTTP/2.0 200 OK\nLink: <https://api.github.com/repositories/123/commits/sha1/statuses?per_page=100&page=1>; rel="prev"\n\n[{"id":2}]\n',
  );
  assert.match(two.log, /page=2/);
  const docs = two.pages.trim().split('\n').map((line) => JSON.parse(line) as { next: string | null; body: { id: number }[] });
  assert.equal(docs.length, 2);
  assert.equal(docs[0].next, next);
  assert.equal(docs[1].next, null);
  assert.equal(docs[1].body[0].id, 2);

  assert.throws(() => run('HTTP/2.0 200 OK\n\n[]\n', '', 1), /pagination request failed/);
  assert.throws(
    () => run('HTTP/2.0 500 OK\n\n{"message":"boom"}\n'),
    /HTTP 500/,
  );
  assert.throws(
    () => run('HTTP/2.0 200 OK\nLink: <https://evil.example/statuses?page=2>; rel="next"\n\n[]\n'),
    /outside this commit/,
  );
  const loop = 'https://api.github.com/repositories/123/commits/sha1/statuses?per_page=100&page=2';
  assert.throws(
    () => run(
      `HTTP/2.0 200 OK\nLink: <${loop}>; rel="next"\n\n[]\n`,
      `HTTP/2.0 200 OK\nLink: <${loop}>; rel="next"\n\n[]\n`,
    ),
    /repeated a Link URL/,
  );
  const full = `[${Array.from({ length: 100 }, (_, index) => `{"id":${index + 1}}`).join(',')}]`;
  const hundred = run(`HTTP/2.0 200 OK\n\n${full}\n`);
  const hundredPage = JSON.parse(hundred.pages) as { next: string | null; body: unknown[] };
  assert.equal(hundredPage.next, null);
  assert.equal(hundredPage.body.length, 100);
  assert.equal(hundred.log.trim().split('\n').length, 1);
});

test('stale does not hide a real failure and does not count as success', () => {
  const hidden = select(
    page([
      check({ id: 2, name: 'build', conclusion: 'stale', started: '2026-11-11T04:00:00Z', run: 2 }),
      check({ id: 1, name: 'build', conclusion: 'failure', started: '2026-11-11T03:00:00Z', run: 1 }),
    ], 'check_runs'),
    page([
      runMeta(1, PATH_CI, '2026-11-11T03:00:00Z'),
      runMeta(2, PATH_CI, '2026-11-11T04:00:00Z'),
    ], 'workflow_runs'),
    [],
  );
  assert.equal(hidden.checks.red, 1);

  const replaced = select(
    page([
      check({ id: 1, name: 'build', conclusion: 'stale', started: '2026-11-11T03:00:00Z', run: 1 }),
      check({ id: 2, name: 'build', conclusion: 'success', started: '2026-11-11T04:00:00Z', run: 2 }),
    ], 'check_runs'),
    page([
      runMeta(1, PATH_CI, '2026-11-11T03:00:00Z'),
      runMeta(2, PATH_CI, '2026-11-11T04:00:00Z'),
    ], 'workflow_runs'),
    [],
  );
  assert.equal(replaced.checks.green, 1);
  assert.equal(replaced.checks.red, 0);

  const only = select(
    page([check({ id: 1, name: 'build', conclusion: 'stale', started: 't', run: 1 })], 'check_runs'),
    page([runMeta(1, PATH_CI, 't')], 'workflow_runs'),
    [],
  );
  assert.equal(only.checks.green, 0);
  assert.equal(only.checks.red, 0);
});
