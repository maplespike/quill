// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * CI guard for the "ambient gh auth" class (2026-09-22).
 *
 * `pr-validation.yml` ran `gh pr view` in the commit-message check with no
 * GH_TOKEN in the step env. The `gh` CLI then falls back to the runner's own
 * `~/.config/gh/hosts.yml`: the nexus runners hold an interactive login, the
 * forge runner does not. The identical commit therefore passed on nexus and
 * died on forge with
 *
 *   gh: To use GitHub CLI in a GitHub Actions workflow, set the GH_TOKEN
 *   environment variable.
 *   ##[error]Process completed with exit code 4.
 *
 * (PR validation run 35679142663, PR #893, commit 9d1da8da.)
 *
 * The guard asserts that every workflow `run:` body which invokes the `gh`
 * CLI receives a token from an enclosing `env:` scope — the step itself, its
 * job, the workflow, or the body. `gh` reads GH_TOKEN first, then
 * GITHUB_TOKEN; both are accepted.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** `gh` sub-commands. Prose mentions of `gh` do not match. */
const GH_CLI =
  /\bgh\s+(?:pr|api|issue|run|release|auth|repo|workflow|variable|secret|cache|gist|label|project|search|status|attestation|browse|config|extension|org|ruleset|ssh-key|gpg-key)\b/;

/** Either name authenticates `gh`. */
const TOKEN_NAMES: readonly string[] = ['GH_TOKEN', 'GITHUB_TOKEN'];

/** The incident site: step name in pr-validation.yml that calls `gh`. */
const INCIDENT_STEP = 'Commit message check';
const INCIDENT_FILE = '.github/workflows/pr-validation.yml';

interface EnvScope {
  /** Column of the `env:` key. Smaller indent = wider scope. */
  indent: number;
  /** List item (step) that owns this scope, or -1 for job/workflow level. */
  itemId: number;
  keys: Set<string>;
}

interface Frame {
  indent: number;
  key: string;
  env?: EnvScope;
}

interface GhCall {
  file: string;
  line: number;
  text: string;
  /** Column of the `run:` key that owns this call. */
  indent: number;
  itemId: number;
  itemName: string;
  /** True when the run body itself sets or exports a token name. */
  bodyHasToken: boolean;
}

interface Scan {
  calls: GhCall[];
  scopes: EnvScope[];
}

function indentOf(line: string): number {
  const match = /^[ \t]*/.exec(line);
  return match ? match[0].length : 0;
}

/** Strip one layer of wrapping quotes from a scalar. */
function unquote(value: string): string {
  const match = /^(['"])(.*)\1$/.exec(value);
  return match ? match[2] : value;
}

/** Keys of a flow-style mapping body (`{A: 1, B: 2}`), if any. */
function flowKeys(value: string): string[] {
  if (!value.startsWith('{')) return [];
  const keys: string[] = [];
  for (const match of value.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) keys.push(match[1]);
  return keys;
}

/**
 * Line-based scan of one workflow file. YAML indentation carries the scopes:
 * a key at column N is a child of the innermost frame with a smaller column,
 * and a `- ` list item starts a frame at its own column.
 */
function scanWorkflow(file: string, source: string): Scan {
  const lines = source.split('\n');
  const scopes: EnvScope[] = [];
  const calls: GhCall[] = [];
  const frames: Frame[] = [];
  const itemNames = new Map<number, string>();
  let itemCounter = 0;
  let currentItem = -1;
  let runOpen: { indent: number; itemId: number; body: { line: number; text: string }[] } | null = null;

  const processBody = (
    indent: number,
    itemId: number,
    body: { line: number; text: string }[],
  ): void => {
    const code = body.filter(entry => !/^\s*#/.test(entry.text));
    const bodyText = code.map(entry => entry.text).join('\n');
    const bodyHasToken = TOKEN_NAMES.some(name => new RegExp(`\\b${name}\\b`).test(bodyText));
    for (const entry of code) {
      if (!GH_CLI.test(entry.text)) continue;
      calls.push({
        file,
        line: entry.line,
        text: entry.text.trim(),
        indent,
        itemId,
        itemName: itemNames.get(itemId) ?? '',
        bodyHasToken,
      });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '');

    if (runOpen) {
      if (line.trim() === '' || indentOf(line) > runOpen.indent) {
        if (line.trim() !== '') runOpen.body.push({ line: i + 1, text: line });
        continue;
      }
      processBody(runOpen.indent, runOpen.itemId, runOpen.body);
      runOpen = null;
    }

    const stripped = line.trim();
    if (stripped === '' || stripped.startsWith('#')) continue;

    let keyIndent = indentOf(line);
    let rest = stripped;
    const listItem = /^-\s+(.*)$/.exec(stripped);
    if (listItem) {
      currentItem = ++itemCounter;
      while (frames.length > 0 && frames[frames.length - 1].indent >= keyIndent) frames.pop();
      frames.push({ indent: keyIndent, key: `<item:${currentItem}>` });
      keyIndent += 2;
      rest = listItem[1];
    }

    const pair = /^([A-Za-z0-9_."'-]+):\s*(.*)$/.exec(rest);
    if (!pair) continue;
    const key = pair[1];
    const value = pair[2].trim();

    while (frames.length > 0 && frames[frames.length - 1].indent >= keyIndent) frames.pop();
    const parent = frames.length > 0 ? frames[frames.length - 1] : null;

    // A key directly under an `env:` frame is an env var name.
    if (parent && parent.key === 'env') {
      if (parent.env) parent.env.keys.add(key);
      frames.push({ indent: keyIndent, key });
      continue;
    }

    if (key === 'env') {
      const scope: EnvScope = { indent: keyIndent, itemId: currentItem, keys: new Set() };
      for (const flowKey of flowKeys(value)) scope.keys.add(flowKey);
      scopes.push(scope);
      frames.push({ indent: keyIndent, key, env: scope });
      continue;
    }

    if (key === 'run') {
      frames.push({ indent: keyIndent, key });
      if (value === '' || /^[|>][+-]?$/.test(value)) {
        runOpen = { indent: keyIndent, itemId: currentItem, body: [] };
      } else {
        processBody(keyIndent, currentItem, [{ line: i + 1, text: value }]);
      }
      continue;
    }

    if (key === 'name' && parent && parent.key === `<item:${currentItem}>`) {
      itemNames.set(currentItem, unquote(value));
    }

    frames.push({ indent: keyIndent, key });
  }

  if (runOpen) processBody(runOpen.indent, runOpen.itemId, runOpen.body);
  return { calls, scopes };
}

/** Token names visible to a call: enclosing scopes, or set in the body. */
function tokenCoverage(call: GhCall, scopes: EnvScope[]): string[] {
  if (call.bodyHasToken) return ['<set in run body>'];
  const found: string[] = [];
  for (const scope of scopes) {
    const encloses =
      scope.indent < call.indent || (scope.indent === call.indent && scope.itemId === call.itemId);
    if (!encloses) continue;
    for (const key of scope.keys) if (TOKEN_NAMES.includes(key)) found.push(key);
  }
  return found;
}

function findRepoRoot(start: string): string {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.github', 'workflows', 'pr-validation.yml'))) return dir;
    const parent = path.dirname(dir);
    assert.notEqual(parent, dir, `repo root not found above ${start}`);
    dir = parent;
  }
}

const REPO_ROOT = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
const WORKFLOW_DIR = path.join(REPO_ROOT, '.github', 'workflows');

function workflowSources(): { file: string; source: string }[] {
  return fs
    .readdirSync(WORKFLOW_DIR)
    .filter((name: string) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort()
    .map((name: string) => ({ file: `.github/workflows/${name}`, source: fs.readFileSync(path.join(WORKFLOW_DIR, name), 'utf8') }));
}

describe('CI workflows: gh CLI token', () => {
  it('every run: body that invokes gh receives GH_TOKEN from an enclosing env', () => {
    const problems: string[] = [];
    let checkedCalls = 0;
    for (const { file, source } of workflowSources()) {
      const { calls, scopes } = scanWorkflow(file, source);
      for (const call of calls) {
        checkedCalls++;
        if (tokenCoverage(call, scopes).length === 0) {
          problems.push(`${file}:${call.line}: gh runs without a token -> ${call.text}`);
        }
      }
    }
    assert.ok(checkedCalls > 0, 'scanner found no gh call at all — the detector rotted');
    assert.deepEqual(problems, [], `gh CLI without GH_TOKEN; the runner's own gh login decides the verdict:\n${problems.join('\n')}`);
  });

  it('pr-validation.yml commit-message check passes GH_TOKEN (run 35679142663)', () => {
    const { source } = workflowSources().find(candidate => candidate.file === INCIDENT_FILE)!;
    const { calls, scopes } = scanWorkflow(INCIDENT_FILE, source);
    const call = calls.find(candidate => candidate.itemName === INCIDENT_STEP);
    assert.ok(call, `${INCIDENT_FILE} has no run body in the "${INCIDENT_STEP}" step`);
    assert.ok(GH_CLI.test(call!.text), `"${INCIDENT_STEP}" no longer invokes gh: ${call!.text}`);
    assert.ok(
      tokenCoverage(call!, scopes).length > 0,
      `"${INCIDENT_STEP}" invokes gh without GH_TOKEN — forge runners have no gh login`,
    );
  });

  it('the guard itself detects a token that lives in a sibling step', () => {
    const synthetic = [
      'name: t',
      'on: pull_request',
      'jobs:',
      '  j:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - name: has-token',
      '        env:',
      '          GH_TOKEN: ${{ github.token }}',
      '        run: |',
      '          gh pr view 1 --json commits',
      '      - name: no-token',
      '        run: |',
      '          # prose mention of gh pr checks must not count',
      '          gh api /repos/o/r/actions/runs/1/jobs',
    ].join('\n');

    const { calls, scopes } = scanWorkflow('synthetic.yml', synthetic);
    const covered = calls.find(call => call.itemName === 'has-token');
    const uncovered = calls.find(call => call.itemName === 'no-token');
    assert.ok(covered, 'token-carrying step not detected');
    assert.ok(uncovered, 'token-less step not detected');
    assert.deepEqual(tokenCoverage(covered!, scopes), ['GH_TOKEN']);
    assert.deepEqual(tokenCoverage(uncovered!, scopes), []);
    assert.equal(calls.length, 2, 'comment-only gh mentions must not count as calls');
  });
});
