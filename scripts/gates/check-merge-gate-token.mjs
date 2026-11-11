#!/usr/bin/env node
// Merge-when-green metadata token (#1278) and the false-success follow-up.
//
// Run 42579953147 evaluated #1275 with GH_TOKEN=github.token. `gh pr view`
// returned a null GraphQL headRepository through five retries and the gate
// exited 0. Run 42959473763 did it again on #1326 after the fleet-merge-gate
// App token was minted: the token was not the missing piece. The field was.
// REST head.repo is the read that pull-request permission actually returns.
// An empty result after the retries must exit 1. A known foreign head still
// exits 0 and does not merge.
//
// The pulls, check-run, workflow-run, and commit-status reads must use the
// App token. A foreign event head must exit before the token is selected.
// A `hold` label must skip. `ready-to-merge` stays required. The workflow
// must not check out or run pull-request head code.
//
// Usage:
//   node scripts/gates/check-merge-gate-token.mjs [workflow-file]
// Exit 0 when the contract holds. Exit 1 with one line per violation.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EVENT_HEAD_IF = /if\s+\[\[\s+-n\s+"\$\{EVENT_HEAD_REPO:-}"\s+&&\s+"\$EVENT_HEAD_REPO"\s+!=\s+"\$GH_REPO"\s+\]\]/;
const RESOLVED_HEAD_IF = /if\s+\[\[\s+"\$HEAD_REPO"\s+!=\s+"\$GH_REPO"\s+\]\]/;
const EMPTY_HEAD_IF = /if\s+\[\[\s+-z\s+"\$HEAD_REPO"\s+\]\]/;
const EVENT_MISMATCH_IF = /if\s+\[\[\s+-n\s+"\$\{EVENT_HEAD_REPO:-}"\s+&&\s+"\$EVENT_HEAD_REPO"\s+!=\s+"\$HEAD_REPO"\s+\]\]/;
const UNKNOWN_MERGEABLE_IF = /if\s+\[\[\s+"\$MERGEABLE"\s+==\s+"UNKNOWN"\s+\]\]/;
const HOLD_IF = /if\s+\[\[\s+"\$\(jq -r 'any\(\.labels\[\]; \.name == "hold"\)'/;
const READY_IF = /if\s+\[\[\s+"\$\(jq -r 'any\(\.labels\[\]; \.name == "ready-to-merge"\)'/;
const PULLS_READ = 'gh api "repos/${GH_REPO}/pulls/${PR_NUMBER}"';

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

function ifBody(code, regex) {
  const match = regex.exec(code);
  if (!match) return null;
  const after = code.slice(match.index);
  const fi = after.search(/\n\s*fi\b/);
  if (fi < 0) return null;
  return { index: match.index, body: after.slice(0, fi) };
}

function ifBodyExits(code, regex, status) {
  const found = ifBody(code, regex);
  if (!found) return false;
  return new RegExp(`\\bexit\\s+${status}\\b`).test(found.body);
}

function ghIndex(code, command) {
  const match = new RegExp(`\\bgh\\s+${command}\\b`).exec(code);
  return match ? match.index : -1;
}

/**
 * The command at `at` carries the fleet-merge-gate App token on its own
 * line. A token on the previous command does not count. An inline
 * GATE_TOKEN override on that line also passes. A READ_TOKEN use passes
 * only when the last assignment is the App token.
 */
function commandUsesAppToken(code, at) {
  const lineStart = code.lastIndexOf('\n', at - 1) + 1;
  const prelude = code.slice(lineStart, at);
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
  const pullsAt = code.indexOf(PULLS_READ);
  const mergeAt = ghIndex(code, 'pr merge');
  if (pullsAt < 0) {
    fail('metadata-app-token', 'REST pulls read for head.repo is missing');
    return violations;
  }
  if (mergeAt < 0 || mergeAt < pullsAt) {
    fail('fork-resolved-head', 'gh pr merge is missing or precedes the metadata read');
  }
  if (!commandUsesAppToken(code, pullsAt)) {
    fail('metadata-app-token', 'REST pulls read does not use the fleet-merge-gate App token');
  }
  if (code.includes('headRepository') || code.includes('gh pr view')) {
    fail('graphql-head', 'head repository must be read from REST head.repo, not GraphQL headRepository');
  }
  if (!code.includes('.head.repo')) {
    fail('metadata-app-token', 'pull normalization must read REST head.repo');
  }

  const checksAt = code.indexOf('/check-runs');
  const statusesAt = code.indexOf('/statuses');
  const runsAt = code.indexOf('actions/runs?head_sha=');
  if (checksAt < 0 || !commandUsesAppToken(code, checksAt)) {
    fail('metadata-app-token', 'check-runs read does not use the fleet-merge-gate App token');
  }
  if (statusesAt < 0 || !commandUsesAppToken(code, statusesAt)) {
    fail('metadata-app-token', 'commit statuses read does not use the fleet-merge-gate App token');
  }
  if (runsAt < 0 || !commandUsesAppToken(code, runsAt)) {
    fail('metadata-app-token', 'workflow run read does not use the fleet-merge-gate App token');
  }
  for (const needle of [PULLS_READ, '/check-runs', '/statuses', 'actions/runs?head_sha=']) {
    const at = code.indexOf(needle);
    const line = code.slice(at, code.indexOf('\n', at) === -1 ? code.length : code.indexOf('\n', at));
    if (at >= 0 && line.includes('|| true')) {
      fail('metadata-app-token', `${needle} read swallows API errors`);
    }
  }

  const gateAssign = code.indexOf('READ_TOKEN="$GATE_TOKEN"');
  const eventIf = EVENT_HEAD_IF.exec(code);
  if (!eventIf || !ifBodyExits(code, EVENT_HEAD_IF, 0)) {
    fail('fork-event-head', 'a foreign event head repo must exit 0 before any App-token read');
  } else if (gateAssign >= 0 && eventIf.index > gateAssign) {
    fail('fork-event-head', 'the foreign event-head exit must run before READ_TOKEN is set to the App token');
  }

  const between = code.slice(pullsAt, mergeAt < 0 ? code.length : mergeAt);
  const emptyHead = ifBody(between, EMPTY_HEAD_IF);
  const foreignHead = ifBody(between, RESOLVED_HEAD_IF);
  if (!emptyHead || !/\bexit\s+1\b/.test(emptyHead.body)) {
    fail('unknown-head', 'a missing head repository after the read retries must exit 1 before merge');
  } else if (/\bexit\s+0\b/.test(emptyHead.body)) {
    fail('unknown-head', 'a missing head repository must not take the foreign-repo success skip');
  }
  if (!foreignHead || !/\bexit\s+0\b/.test(foreignHead.body)) {
    fail('fork-resolved-head', 'a known foreign resolved head repo must exit 0 before merge');
  } else if (emptyHead && emptyHead.index > foreignHead.index) {
    fail('unknown-head', 'the missing-head failure must run before the foreign-repo skip');
  }
  const mismatch = ifBody(between, EVENT_MISMATCH_IF);
  if (!mismatch || !/\bexit\s+1\b/.test(mismatch.body)) {
    fail('unknown-head', 'an event head that disagrees with the pulls API must exit 1 before merge');
  }
  const unknownMergeable = ifBody(between, UNKNOWN_MERGEABLE_IF);
  if (!unknownMergeable || !/\bexit\s+1\b/.test(unknownMergeable.body)) {
    fail('unknown-mergeable', 'an unknown mergeable value after the read retries must exit 1 before merge');
  }
  if (!HOLD_IF.test(between) || !ifBodyExits(between, HOLD_IF, 0)) {
    fail('hold-label', 'a hold label must exit 0 before merge');
  }
  if (!READY_IF.test(between) || !ifBodyExits(between, READY_IF, 0)) {
    fail('ready-to-merge', 'ready-to-merge must still be required before merge');
  }
  if (!code.includes("--argjson required '[]'")) {
    fail('required-checks', 'check selection must receive the required-check list');
  }
  if (!script.includes('# BEGIN select-merge-checks.jq') || !script.includes('# END select-merge-checks.jq')) {
    fail('check-identity', 'check selection program markers are missing');
  }
  if (!script.includes('# BEGIN normalize-pull.jq') || !script.includes('# END normalize-pull.jq')) {
    fail('metadata-app-token', 'pull normalization program markers are missing');
  }

  return violations;
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
