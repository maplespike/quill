#!/usr/bin/env node
// Workflow `gh` auth guard — a step that shells out to `gh` must pass a token
// in its env scope (its own `env:`, its job's `env:`, or the workflow `env:`).
//
// Why this exists
// ---------------
// The repo runs on a `[self-hosted, nixos]` runner pool whose hosts do not
// share runner state. A step that relies on the runner's *ambient* `gh`
// authentication therefore passes on one host and fails on another:
//
//   * #857 — Issue Auto-Triage died with `gh: command not found` (exit 127)
//     after the runner moved to a host without `gh` on the service PATH.
//   * PR 908 (run 35684897034) — `PR validation` → "Commit message check" ran
//     `gh pr view` with no GH_TOKEN. On `nexus-quill-runner` the stored
//     credentials covered it; on `forge-quill-runner` there are none, so `gh`
//     exited 4 ("To use GitHub CLI in a GitHub Actions workflow, set the
//     GH_TOKEN environment variable") and the required `PR checks` check went
//     red on a PR whose commits were fine. Same file, same SHA, two verdicts.
//
// `GH_TOKEN: ${{ github.token }}` is minted per run and is present on every
// runner, so the check stops depending on host state.
//
// Scope of the check: `run:` bodies in `.github/workflows/*.yml`. A `gh`
// invocation hidden inside a shell script the step calls (e.g.
// scripts/quill-issue-triage.sh) is not visible here — keep those scripts
// token-honest by their own means.
//
// Pure Node, no dependencies (CI ships no YAML library). The parser and
// scanner are exported for scripts/test-workflow-gh-auth.mts.
//
// Usage:
//   node scripts/gates/check-workflow-gh-auth.mjs [workflows-dir]
// Exit 0 + "workflow gh auth: OK …" when every `gh` step is token-scoped;
// exit 1 + one line per violation otherwise.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOKEN_KEYS = ['GH_TOKEN', 'GITHUB_TOKEN'];

// `gh <subcommand>` or `gh --flag`: the CLI is actually being invoked.
const GH_INVOKE_RE = /\bgh\s+(?:--)?[a-z][a-z-]*/g;

// …and these forms never need credentials.
const INFORMATIONAL_RE = /^gh\s+(?:--version|--help|version|help|completion)\b/;

// Writes that change a branch or merge it. `gh pr merge` and
// `gh pr update-branch` are both pushes from the API's point of view, so for a
// PR that edits .github/workflows they are refused for GITHUB_TOKEN: "refusing
// to allow a GitHub App to create or update workflow". Only the
// fleet-merge-gate App installation token (Workflows:write) can do them.
const BRANCH_WRITE_RE = /\bgh\s+pr\s+(?:merge|update-branch|rebase)\b/g;

// A GH_TOKEN value that resolves to the minted App token.
const APP_TOKEN_VALUE_RE = /steps\.gate\.outputs\.token|MERGE_GATE_APP/;

const indentOf = (line) => line.length - line.trimStart().length;
const isBlank = (line) => line.trim() === '';
const isComment = (line) => /^\s*#/.test(line);

/**
 * `gh` invocations in a block of lines that require authentication.
 * @returns {Array<{invocation: string, line: number}>} 0-based `line` indexes
 *   are relative to the passed slice.
 */
export function authGhInvocations(lines) {
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isBlank(line) || isComment(line)) continue;
    const matches = line.match(GH_INVOKE_RE) ?? [];
    for (const m of matches) {
      if (!INFORMATIONAL_RE.test(m)) found.push({ invocation: m, line: i });
    }
  }
  return found;
}

/**
 * In a `- name: …` / `- uses: …` list, the index of the first line at or below
 * `start` that closes the item (a dedent past the item's own indent).
 */
function blockEnd(lines, start, indent) {
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (isBlank(line) || isComment(line)) continue;
    if (indentOf(line) <= indent) return i;
  }
  return lines.length;
}

/** Key name and indent of a mapping entry, tolerating a leading `- `. */
function keyOf(line) {
  const m = line.match(/^(\s*)(?:-\s+)?([A-Za-z0-9_.-]+):/);
  return m ? { key: m[2], indent: m[1].length + (line.trimStart().startsWith('- ') ? 2 : 0) } : null;
}

/** True when the mapping at `containerIndent` owns an `env:` whose entries carry a token. */
function envAtIndentHasToken(lines, from, end, containerIndent) {
  for (let i = from; i < end; i++) {
    const line = lines[i];
    if (isBlank(line) || isComment(line)) continue;
    const parsed = keyOf(line);
    if (!parsed || parsed.indent !== containerIndent || parsed.key !== 'env') continue;
    for (let j = i + 1; j < end; j++) {
      const entry = lines[j];
      if (isBlank(entry) || isComment(entry)) continue;
      if (indentOf(entry) <= containerIndent) break;
      const entryKey = keyOf(entry);
      if (entryKey && TOKEN_KEYS.includes(entryKey.key)) return true;
    }
  }
  return false;
}

/**
 * Ancestor mapping keys above `idx`, nearest first, with strictly decreasing
 * indent (`steps:` → the job key → `jobs:` → the workflow root keys).
 */
function ancestors(lines, idx) {
  const chain = [];
  let level = indentOf(lines[idx]) + 1;
  for (let i = idx - 1; i >= 0 && level > 0; i--) {
    const line = lines[i];
    if (isBlank(line) || isComment(line)) continue;
    const indent = indentOf(line);
    if (indent >= level) continue;
    chain.push({ index: i, indent });
    level = indent;
  }
  return chain;
}

/**
 * The `run:` bodies of a step item, flattened to `{text, line}` pairs (0-based
 * `line` indexes into the file). Only `run:` lines execute, so only they can
 * invoke `gh` — a step name, a `with:` value or a comment that merely mentions
 * `gh` must not trip the guard.
 */
function runBodies(lines, start, end, itemIndent) {
  const bodies = [];
  for (let i = start; i < end; i++) {
    const line = lines[i];
    if (isBlank(line) || isComment(line)) continue;
    const parsed = keyOf(line);
    if (!parsed || parsed.indent !== itemIndent + 2 || parsed.key !== 'run') continue;
    const inline = line.replace(/^\s*(?:-\s+)?run:\s*/, '');
    if (inline && !/^[|>]/.test(inline)) bodies.push({ text: inline, line: i });
    for (let j = i + 1; j < end; j++) {
      const body = lines[j];
      if (isBlank(body) || isComment(body)) continue;
      if (indentOf(body) <= parsed.indent) break;
      bodies.push({ text: body, line: j });
    }
  }
  return bodies;
}

/** `gh` invocations that require auth, keeping each one's absolute file line. */
function authGhInvocationsAt(bodies) {
  const found = [];
  for (const { text, line } of bodies) {
    const matches = text.match(GH_INVOKE_RE) ?? [];
    for (const m of matches) {
      if (!INFORMATIONAL_RE.test(m)) found.push({ invocation: m, line });
    }
  }
  return found;
}

/**
 * True when `index` (a mapping key at `indent`) has a sibling `env:` carrying a
 * token. The sibling may precede or follow the key, so the whole enclosing
 * block is searched.
 */
function siblingEnvHasToken(lines, index, indent) {
  let from = index - 1;
  while (from >= 0) {
    const line = lines[from];
    if (!isBlank(line) && !isComment(line) && indentOf(line) < indent) break;
    from -= 1;
  }
  let end = index + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (!isBlank(line) && !isComment(line) && indentOf(line) < indent) break;
    end += 1;
  }
  return envAtIndentHasToken(lines, from + 1, end, indent);
}

/**
 * The workflow-level `env:` (a top-level key that sits above `jobs:`).
 */
function workflowEnvHasToken(lines) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isBlank(line) || isComment(line)) continue;
    const parsed = keyOf(line);
    if (!parsed || parsed.indent !== 0 || parsed.key !== 'env') continue;
    if (envAtIndentHasToken(lines, i, blockEnd(lines, i, 0), 0)) return true;
  }
  return false;
}

/**
 * Find every workflow step that invokes `gh` without a token in scope.
 * @param {string} text workflow YAML
 * @param {string} file label used in the report
 * @returns {{violations: Array<{file: string, line: number, step: string, invocation: string}>, ghSteps: number}}
 */
export function findUnguardedGhSteps(text, file = '<inline>') {
  const lines = text.split(/\r?\n/);
  const violations = [];
  let ghSteps = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isBlank(line) || isComment(line)) continue;
    const item = line.match(/^(\s*)-\s+\S/);
    if (!item) continue;

    const startIndent = indentOf(line);
    const end = blockEnd(lines, i, startIndent);
    const block = lines.slice(i, end);
    const invocations = authGhInvocationsAt(runBodies(lines, i, end, startIndent));
    if (invocations.length === 0) continue;
    ghSteps += 1;

    // The step's own `env:` lives at the item's child indent.
    const stepGuarded = envAtIndentHasToken(lines, i, end, startIndent + 2);
    // …otherwise the job's `env:` (a sibling of `steps:`) or any other
    // enclosing mapping's `env:` covers it…
    const enclosingGuarded = ancestors(lines, i).some(({ index, indent }) =>
      siblingEnvHasToken(lines, index, indent),
    );
    // …and the workflow-level `env:` covers every job in the file.
    const jobGuarded = enclosingGuarded || workflowEnvHasToken(lines);

    if (!stepGuarded && !jobGuarded) {
      const nameLine = block.find((l) => /^\s*(?:-\s+)?name:/.test(l));
      const name = nameLine
        ? nameLine.replace(/^\s*(?:-\s+)?name:\s*/, '').replace(/^["']|["']$/g, '')
        : (block[0].trim().replace(/^- /, '') || '<unnamed step>');
      const first = invocations[0];
      violations.push({ file, line: first.line + 1, step: name, invocation: first.invocation });
    }
  }

  return { violations, ghSteps };
}

/**
 * True when the `env:` mapping at `containerIndent` sets GH_TOKEN to the App
 * token (the expression that reads the mint step's output).
 */
function envAppTokenAtIndent(lines, from, end, containerIndent) {
  for (let i = from; i < end; i++) {
    const line = lines[i];
    if (isBlank(line) || isComment(line)) continue;
    const parsed = keyOf(line);
    if (!parsed || parsed.indent !== containerIndent || parsed.key !== 'env') continue;
    for (let j = i + 1; j < end; j++) {
      const entry = lines[j];
      if (isBlank(entry) || isComment(entry)) continue;
      if (indentOf(entry) <= containerIndent) break;
      if (/^\s*GH_TOKEN:/.test(entry) && APP_TOKEN_VALUE_RE.test(entry)) return true;
    }
  }
  return false;
}

/**
 * `gh pr merge` / `update-branch` / `rebase` steps whose token is not the
 * fleet-merge-gate App token. GITHUB_TOKEN cannot perform any of these on a PR
 * that edits .github/workflows, and the gate's own update-branch used to fail
 * that way silently (#1252).
 * @returns {{violations: Array<{file: string, line: number, step: string, invocation: string}>, writeSteps: number}}
 */
export function findTokenOnlyWriteSteps(text, file = '<inline>') {
  const lines = text.split(/\r?\n/);
  const violations = [];
  let writeSteps = 0;
  const fileMintsAppToken = text.includes('vars.MERGE_GATE_APP_ID');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isBlank(line) || isComment(line)) continue;
    if (!/^(\s*)-\s+\S/.test(line)) continue;

    const itemIndent = indentOf(line);
    const end = blockEnd(lines, i, itemIndent);
    const writes = [];
    for (const { text: body, line: bodyLine } of runBodies(lines, i, end, itemIndent)) {
      for (const m of body.match(BRANCH_WRITE_RE) ?? []) {
        writes.push({ invocation: m.replace(/\s+/g, ' '), line: bodyLine, text: body });
      }
    }
    if (writes.length === 0) continue;
    writeSteps += 1;

    const stepScoped = envAppTokenAtIndent(lines, i, end, itemIndent + 2);
    for (const write of writes) {
      // `GH_TOKEN="${GATE_TOKEN:-$GH_TOKEN}" gh pr merge …` — a per-call override.
      const inlineOverride = /GH_TOKEN=.*GATE_TOKEN/.test(write.text);
      if (inlineOverride || stepScoped) continue;
      if (!fileMintsAppToken) {
        violations.push({
          file,
          line: write.line + 1,
          step: stepName(lines, i, end),
          invocation: write.invocation,
          reason: 'this workflow never mints the App token (no vars.MERGE_GATE_APP_ID mint step)',
        });
        continue;
      }
      violations.push({
        file,
        line: write.line + 1,
        step: stepName(lines, i, end),
        invocation: write.invocation,
        reason: 'the step token is GITHUB_TOKEN, which cannot push/merge a .github/workflows change',
      });
    }
  }

  return { violations, writeSteps };
}

/** Display name of the step item starting at `start`. */
function stepName(lines, start, end) {
  for (let i = start; i < end; i++) {
    const m = lines[i].match(/^\s*(?:-\s+)?name:\s*(.+)$/);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  return '<unnamed step>';
}

/** Scan a directory of workflow files. */
export function scanWorkflows(dir) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .sort();
  const violations = [];
  const writeViolations = [];
  let ghSteps = 0;
  let writeSteps = 0;
  for (const file of files) {
    const text = readFileSync(path.join(dir, file), 'utf8');
    const result = findUnguardedGhSteps(text, file);
    violations.push(...result.violations);
    ghSteps += result.ghSteps;
    const writes = findTokenOnlyWriteSteps(text, file);
    writeViolations.push(...writes.violations);
    writeSteps += writes.writeSteps;
  }
  return { violations, writeViolations, ghSteps, writeSteps, files };
}

function main(argv) {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const dir = argv[0] ? path.resolve(argv[0]) : path.join(repo, '.github/workflows');
  const { violations, writeViolations, ghSteps, writeSteps, files } = scanWorkflows(dir);

  for (const v of writeViolations) {
    console.error(
      `workflow push-token violation: ${v.file}:${v.line} — step "${v.step}" runs \`${v.invocation}\` with ${v.reason}`,
    );
  }
  if (writeViolations.length) {
    console.error(`workflow push token: FAILED (${writeViolations.length} branch-write step(s) not on the App token)`);
    return 1;
  }
  if (violations.length) {
    for (const v of violations) {
      console.error(
        `workflow gh auth violation: ${v.file}:${v.line} — step "${v.step}" runs \`${v.invocation}\` with no GH_TOKEN/GITHUB_TOKEN in its env, its job env, or the workflow env`,
      );
    }
    console.error(`workflow gh auth: FAILED (${violations.length} violation(s), ${ghSteps} gh-invoking step(s) in ${files.length} file(s))`);
    return 1;
  }
  console.log(`workflow gh auth: OK (${ghSteps} gh-invoking step(s) token-scoped across ${files.length} workflow file(s))`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
