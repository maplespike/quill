#!/usr/bin/env node
// Merge-when-green metadata token (#1278).
//
// Run 42579953147 evaluated #1275 with GH_TOKEN=github.token. `gh pr view`
// returned headRepository null through five retries and the gate exited 0:
// "PR #1275 head repo unknown is not maplespike/quill". The same null was
// still returned for #1252 in run 42690795055, after the fleet-merge-gate
// App token was minted for branch writes only. Labels were readable; the
// head repository was not, so a green ready-to-merge PR never reached the
// check-state read or the merge.
//
// The metadata read (gh pr view, check-runs, commit statuses) must use that
// App token. A foreign event head must exit before the token is selected.
// A foreign resolved head must exit before merge. An empty or null head,
// missing metadata, or an API error must fail the job (non-zero) and write
// a job summary. Pushes (update-branch, squash-merge) use the App token
// with no GITHUB_TOKEN fallback, so the push triggers CI. MERGEABLE +
// UNSTABLE compares base...head with that token and updates when behind_by
// is greater than zero. CONFLICTING / DIRTY writes a job summary and one
// idempotent comment. A `hold` label must skip. `ready-to-merge` stays
// required. The workflow must not check out or run pull-request head code.
//
// Usage:
//   node scripts/gates/check-merge-gate-token.mjs [workflow-file]
// Exit 0 when the contract holds. Exit 1 with one line per violation.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EVENT_HEAD_IF = /if\s+\[\[\s+-n\s+"\$\{EVENT_HEAD_REPO:-}"\s+&&\s+"\$EVENT_HEAD_REPO"\s+!=\s+"\$GH_REPO"\s+\]\]/;
const RESOLVED_HEAD_IF = /if\s+\[\[\s+"\$HEAD_REPO"\s+!=\s+"\$GH_REPO"\s+\]\]/;
const HOLD_IF = /if\s+\[\[\s+"\$\(jq -r 'any\(\.labels\[\]; \.name == "hold"\)'/;
const READY_IF = /if\s+\[\[\s+"\$\(jq -r 'any\(\.labels\[\]; \.name == "ready-to-merge"\)'/;

function foldedBlock(text, key) {
  const re = new RegExp(`^ {4}${key}:\\s*>-\\n((?: {6}.*\\n)*)`, 'm');
  return re.exec(text)?.[1] ?? '';
}

function evaluateScript(text) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('name: Evaluate the gate once')) continue;
    for (let j = i + 1; j < lines.length; j++) {
      const run = lines[j].match(/^(\s+)run:\s*[|>]/);
      if (!run) continue;
      const runIndent = run[1].length;
      const body = [];
      for (let k = j + 1; k < lines.length; k++) {
        const line = lines[k];
        if (line.trim() !== '' && line.length - line.trimStart().length <= runIndent) break;
        body.push(line);
      }
      return body.join('\n');
    }
  }
  return null;
}

function stripBashComments(script) {
  return script
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

function ifBodyExitsZero(code, regex) {
  const match = regex.exec(code);
  if (!match) return false;
  const after = code.slice(match.index);
  const fi = after.search(/\n\s*fi\b/);
  if (fi < 0) return false;
  return /\bexit\s+0\b/.test(after.slice(0, fi));
}

function ghIndex(code, command) {
  const match = new RegExp(`\\bgh\\s+${command}\\b`).exec(code);
  return match ? match.index : -1;
}

/**
 * The command at `at` uses READ_TOKEN, and the last READ_TOKEN assignment
 * before it is the fleet-merge-gate App token. An inline GATE_TOKEN override
 * on the command itself also passes.
 */
function commandUsesAppToken(code, at) {
  const prelude = code.slice(Math.max(0, at - 400), at);
  if (/GH_TOKEN="\$\{?GATE_TOKEN/.test(prelude) || /GATE_TOKEN:-\$GH_TOKEN/.test(prelude)) return true;
  if (!/GH_TOKEN="\$READ_TOKEN"/.test(prelude)) return false;
  const assigns = [...code.slice(0, at).matchAll(/READ_TOKEN="([^"]+)"/g)];
  const last = assigns.at(-1)?.[1] ?? '';
  return last.includes('GATE_TOKEN');
}

/**
 * @param {string} text workflow YAML
 * @param {string} file label used in the report
 * @returns {Array<{file: string, code: string, message: string}>}
 */
export function auditMergeGate(text, file = 'merge-when-green.yml') {
  const violations = [];
  const fail = (code, message) => violations.push({ file, code, message });

  if (!/uses:\s*actions\/create-github-app-token@/.test(text)) {
    fail('metadata-app-token', 'workflow does not mint a token with actions/create-github-app-token');
  }
  if (!text.includes('app-id: ${{ vars.MERGE_GATE_APP_ID }}')) {
    fail('metadata-app-token', 'mint step does not use vars.MERGE_GATE_APP_ID');
  }
  if (!text.includes('private-key: ${{ secrets.MERGE_GATE_APP_PRIVATE_KEY }}')) {
    fail('metadata-app-token', 'mint step does not use secrets.MERGE_GATE_APP_PRIVATE_KEY');
  }
  if (!/GATE_TOKEN:\s*\$\{\{\s*steps\.gate\.outputs\.token\s*\}\}/.test(text)) {
    fail('metadata-app-token', 'GATE_TOKEN is not steps.gate.outputs.token');
  }

  const jobIf = foldedBlock(text, 'if');
  const runsOn = foldedBlock(text, 'runs-on');
  for (const [label, block] of [['job if', jobIf], ['runs-on', runsOn]]) {
    if (!block.includes('github.event.pull_request.head.repo.full_name == github.repository')) {
      fail('fork-job-if', `${label} no longer requires the pull_request_target head repo to be this repository`);
    }
    if (!block.includes('github.event.workflow_run.head_repository.full_name == github.repository')) {
      fail('fork-job-if', `${label} no longer requires the workflow_run head repository to be this repository`);
    }
  }

  if (/uses:\s*actions\/checkout\b/.test(text) || /\bgh\s+pr\s+checkout\b/.test(text)) {
    fail('fork-checkout', 'merge-when-green checks out or runs pull-request head code');
  }

  const script = evaluateScript(text);
  if (script == null) {
    fail('metadata-app-token', 'Evaluate the gate once step has no run script');
    return violations;
  }
  const code = stripBashComments(script);
  const viewAt = ghIndex(code, 'pr view');
  const mergeAt = ghIndex(code, 'pr merge');
  if (viewAt < 0) {
    fail('metadata-app-token', 'gh pr view metadata read is missing');
    return violations;
  }
  if (mergeAt < 0 || mergeAt < viewAt) {
    fail('fork-resolved-head', 'gh pr merge is missing or precedes the metadata read');
  }

  const viewBlock = code.slice(viewAt, viewAt + 500);
  if (!viewBlock.includes('headRepository') || !viewBlock.includes('labels') || !viewBlock.includes('headRefOid')) {
    fail('metadata-app-token', 'gh pr view must request headRepository, labels, and headRefOid');
  }
  if (!commandUsesAppToken(code, viewAt)) {
    fail('metadata-app-token', 'gh pr view does not use the fleet-merge-gate App token');
  }

  const checksAt = code.indexOf('/check-runs');
  const statusesAt = code.indexOf('/statuses');
  if (checksAt < 0 || !commandUsesAppToken(code, checksAt)) {
    fail('metadata-app-token', 'check-runs read does not use the fleet-merge-gate App token');
  }
  if (statusesAt < 0 || !commandUsesAppToken(code, statusesAt)) {
    fail('metadata-app-token', 'commit statuses read does not use the fleet-merge-gate App token');
  }

  const gateAssign = code.indexOf('READ_TOKEN="$GATE_TOKEN"');
  const eventIf = EVENT_HEAD_IF.exec(code);
  if (!eventIf || !ifBodyExitsZero(code, EVENT_HEAD_IF)) {
    fail('fork-event-head', 'a foreign event head repo must exit 0 before any App-token read');
  } else if (gateAssign >= 0 && eventIf.index > gateAssign) {
    fail('fork-event-head', 'the foreign event-head exit must run before READ_TOKEN is set to the App token');
  }

  const between = code.slice(viewAt, mergeAt < 0 ? code.length : mergeAt);
  if (!RESOLVED_HEAD_IF.test(between) || !ifBodyExitsZero(between, RESOLVED_HEAD_IF)) {
    fail('fork-resolved-head', 'a foreign or unknown resolved head repo must exit 0 before merge');
  }
  if (!HOLD_IF.test(between) || !ifBodyExitsZero(between, HOLD_IF)) {
    fail('hold-label', 'a hold label must exit 0 before merge');
  }
  if (!READY_IF.test(between) || !ifBodyExitsZero(between, READY_IF)) {
    fail('ready-to-merge', 'ready-to-merge must still be required before merge');
  }

  const unknownHead = /if\s+\[\[\s+-z\s+"\$HEAD_REPO"\s+\|\|\s+"\$HEAD_REPO"\s+==\s+"null"\s+\]\]/;
  const unknownBody = ifBody(code, unknownHead);
  if (!unknownBody || !/fail_gate\b/.test(unknownBody)) {
    fail('unknown-head', 'an unknown or null head repo must fail the job before merge');
  }
  if (!/fail_gate\(\)\s*\{[\s\S]*?GITHUB_STEP_SUMMARY[\s\S]*?\bexit\s+1\b/.test(code)) {
    fail('loud-failure', 'fail_gate must write GITHUB_STEP_SUMMARY and exit 1');
  }
  if (!code.includes('API error reading metadata')) {
    fail('loud-failure', 'a metadata API error must fail the job');
  }
  if (!/MERGEABLE"\]\s*==\s*"UNKNOWN"/.test(code) && !code.includes('"$MERGEABLE" == "UNKNOWN"')) {
    fail('loud-failure', 'UNKNOWN mergeable must not exit 0');
  }

  if (/GATE_TOKEN:-\$GH_TOKEN/.test(code)) {
    fail('push-app-token', 'a GITHUB_TOKEN fallback on a gate push does not trigger CI');
  }
  if (!/GH_TOKEN="\$GATE_TOKEN" gh pr update-branch /.test(code)) {
    fail('push-app-token', 'update-branch must use the App token with no GITHUB_TOKEN fallback');
  }
  if (!/GH_TOKEN="\$GATE_TOKEN" gh pr merge /.test(code)) {
    fail('push-app-token', 'merge must use the App token with no GITHUB_TOKEN fallback');
  }

  if (!/GH_TOKEN="\$GATE_TOKEN" gh api "repos\/\$\{GH_REPO\}\/compare\/\$\{BASE_REF\}\.\.\.\$\{HEAD_SHA\}"/.test(code)) {
    fail('compare-app-token', 'MERGEABLE+UNSTABLE must GET compare/{base}...{head} with the App token');
  }
  if (!code.includes('behind_by')) {
    fail('compare-app-token', 'update-branch must run when behind_by is greater than zero');
  }

  if (!code.includes('CONFLICTING') || !code.includes('DIRTY')) {
    fail('conflict', 'CONFLICTING and DIRTY must be reported');
  }
  if (!code.includes('quill-merge-gate:conflict')) {
    fail('conflict', 'the conflict comment must carry a stable marker so it is posted once');
  }
  if (!code.includes('GITHUB_STEP_SUMMARY')) {
    fail('conflict', 'a conflict must write a job-summary line');
  }

  return violations;
}

function ifBody(code, regex) {
  const match = regex.exec(code);
  if (!match) return null;
  const after = code.slice(match.index);
  const fi = after.search(/\n\s*fi\b/);
  if (fi < 0) return null;
  return after.slice(0, fi);
}

function main(argv) {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const file = argv[0]
    ? path.resolve(argv[0])
    : path.join(repo, '.github/workflows/merge-when-green.yml');
  const violations = auditMergeGate(readFileSync(file, 'utf8'), path.basename(file));
  if (violations.length) {
    for (const v of violations) {
      console.error(`merge-gate token: ${v.file} — ${v.code}: ${v.message}`);
    }
    console.error(`merge-gate token: FAILED (${violations.length} violation(s))`);
    return 1;
  }
  console.log('merge-gate token: OK');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
