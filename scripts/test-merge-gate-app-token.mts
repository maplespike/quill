#!/usr/bin/env tsx
/**
 * Regression for the merge gate's same-repo metadata read (#1278).
 *
 * Run 42579953147 evaluated #1275 after coverage passed. `gh pr view` ran
 * with GH_TOKEN=github.token, returned a null headRepository through five
 * retries, and the step exited 0. Run 42959473763 minted the fleet-merge-gate
 * App token and still exited 0 on #1326, because the read was still that
 * GraphQL field and an empty value took the foreign-repo skip.
 *
 * The guard fails when any of these is reverted:
 *   - the metadata read (REST pulls, check-runs, workflow runs, statuses)
 *     leaves the App token
 *   - a missing head repository or an unknown mergeable value exits 0
 *   - a foreign event head can reach that read, or a known foreign resolved
 *     head can reach the merge
 *   - a `hold` label is no longer a skip
 *
 * `ready-to-merge` stays required. Checkout of pull-request head code fails
 * the guard. Runs as `tsx --test` via `pnpm run test:merge-gate`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { auditMergeGate } from './gates/check-merge-gate-token.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = path.join(REPO, '.github/workflows/merge-when-green.yml');

const workflow = () => fs.readFileSync(WORKFLOW, 'utf8');

function codes(text: string): string[] {
  return auditMergeGate(text).map((v) => v.code);
}

test('the merge gate reads same-repo metadata with the App token and still excludes forks and hold', () => {
  assert.deepEqual(auditMergeGate(workflow()), []);
});

test('reverting the pulls read to the ambient token fails', () => {
  const text = workflow().replace(
    'GH_TOKEN="$READ_TOKEN" gh api "repos/${GH_REPO}/pulls/${PR_NUMBER}"',
    'gh api "repos/${GH_REPO}/pulls/${PR_NUMBER}"',
  );
  assert.ok(codes(text).includes('metadata-app-token'));
});

test('reading GraphQL headRepository again fails', () => {
  const text = workflow().replace(
    "jq -r '.headRepo // empty'",
    "jq -r '.headRepository.nameWithOwner // empty'",
  );
  assert.ok(codes(text).includes('graphql-head'));
});

test('pointing READ_TOKEN at GITHUB_TOKEN fails the metadata read', () => {
  const text = workflow().replace('READ_TOKEN="$GATE_TOKEN"', 'READ_TOKEN="$GH_TOKEN"');
  assert.ok(codes(text).includes('metadata-app-token'));
});

test('dropping the App token off the check-runs read fails', () => {
  const text = workflow().replace(
    'GH_TOKEN="$READ_TOKEN" gh api --paginate "repos/${GH_REPO}/commits/${HEAD_SHA}/check-runs',
    'gh api --paginate "repos/${GH_REPO}/commits/${HEAD_SHA}/check-runs',
  );
  assert.ok(codes(text).includes('metadata-app-token'));
});

test('dropping the App token off the statuses read fails', () => {
  const text = workflow().replace(
    'GH_TOKEN="$READ_TOKEN" gh api --include "repos/${GH_REPO}/commits/${HEAD_SHA}/statuses?per_page=100"',
    'gh api --include "repos/${GH_REPO}/commits/${HEAD_SHA}/statuses?per_page=100"',
  );
  assert.notEqual(text, workflow());
  assert.ok(codes(text).includes('metadata-app-token'));
});

test('dropping the App token off the workflow-run read fails', () => {
  const text = workflow().replace(
    'GH_TOKEN="$READ_TOKEN" gh api --paginate "repos/${GH_REPO}/actions/runs?head_sha=${HEAD_SHA}',
    'gh api --paginate "repos/${GH_REPO}/actions/runs?head_sha=${HEAD_SHA}',
  );
  assert.ok(codes(text).includes('metadata-app-token'));
});

test('swallowing a pulls API error fails', () => {
  const text = workflow().replace(
    'gh api "repos/${GH_REPO}/pulls/${PR_NUMBER}"',
    'gh api "repos/${GH_REPO}/pulls/${PR_NUMBER}" || true',
  );
  assert.ok(codes(text).includes('metadata-app-token'));
});

test('a foreign event head must exit before the App token is selected', () => {
  const block = `          if [[ -n "\${EVENT_HEAD_REPO:-}" && "$EVENT_HEAD_REPO" != "$GH_REPO" ]]; then
            echo "::notice::event head repo \${EVENT_HEAD_REPO} is not \${GH_REPO} — nothing to do."
            exit 0
          fi
`;
  const text = workflow().replace(block, '');
  assert.notEqual(text, workflow(), 'the event-head refusal block must be present to remove');
  assert.ok(codes(text).includes('fork-event-head'));
});

test('selecting the App token before the event-head refusal fails', () => {
  const text = workflow().replace(
    '          if [[ -n "${EVENT_HEAD_REPO:-}" && "$EVENT_HEAD_REPO" != "$GH_REPO" ]]; then',
    '          READ_TOKEN="$GATE_TOKEN"\n          if [[ -n "${EVENT_HEAD_REPO:-}" && "$EVENT_HEAD_REPO" != "$GH_REPO" ]]; then',
  );
  assert.notEqual(text, workflow());
  assert.ok(codes(text).includes('fork-event-head'));
});

test('treating an empty resolved head as a foreign-repo skip fails', () => {
  const text = workflow().replace(
    `          if [[ -z "$HEAD_REPO" ]]; then
            echo "::error::PR #\${PR_NUMBER} head repository is missing after 5 reads of GET /repos/\${GH_REPO}/pulls/\${PR_NUMBER} (head.repo). The gate did not merge. Unknown metadata is not a foreign repository. Re-run the gate after the pulls API returns head.repo.full_name."
            exit 1
          fi
`,
    `          if [[ -z "$HEAD_REPO" ]]; then
            echo "::notice::PR #\${PR_NUMBER} head repo unknown is not \${GH_REPO} — nothing to do."
            exit 0
          fi
`,
  );
  assert.notEqual(text, workflow());
  assert.ok(codes(text).includes('unknown-head'));
});

test('dropping the unknown-mergeable failure fails', () => {
  const text = workflow().replace(
    `          if [[ "$MERGEABLE" == "UNKNOWN" ]]; then
            echo "::error::PR #\${PR_NUMBER} mergeable is still unknown after 5 reads of GET /repos/\${GH_REPO}/pulls/\${PR_NUMBER}. The gate did not merge. Re-run the gate after GitHub finishes the mergeable calculation."
            exit 1
          fi
`,
    '',
  );
  assert.notEqual(text, workflow());
  assert.ok(codes(text).includes('unknown-mergeable'));
});

test('removing the pull_request_target same-repo job if fails', () => {
  const needle = 'github.event.pull_request.head.repo.full_name == github.repository';
  const text = workflow().replace(needle, 'true');
  assert.ok(codes(text).includes('fork-job-if'));
});

test('checking out pull-request head code fails', () => {
  const text = workflow().replace(
    '    steps:\n',
    '    steps:\n      - uses: actions/checkout@v4\n',
  );
  assert.ok(codes(text).includes('fork-checkout'));
});

test('removing the hold skip fails', () => {
  const block = `          if [[ "$(jq -r 'any(.labels[]; .name == "hold")' <<<"$META")" == "true" ]]; then
            echo "::notice::PR #\${PR_NUMBER} has the hold label — nothing to do."
            exit 0
          fi
`;
  const text = workflow().replace(block, '');
  assert.notEqual(text, workflow(), 'the hold skip must be present to remove');
  assert.ok(codes(text).includes('hold-label'));
});

test('removing the ready-to-merge requirement fails', () => {
  const block = `          if [[ "$(jq -r 'any(.labels[]; .name == "ready-to-merge")' <<<"$META")" != "true" ]]; then
            echo "::notice::PR #\${PR_NUMBER} does not have the ready-to-merge label — nothing to do."
            exit 0
          fi
`;
  const text = workflow().replace(block, '');
  assert.notEqual(text, workflow(), 'the ready-to-merge requirement must be present to remove');
  assert.ok(codes(text).includes('ready-to-merge'));
});
