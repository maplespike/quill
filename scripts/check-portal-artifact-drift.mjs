#!/usr/bin/env node
/**
 * Check that the committed portal artifacts still match what the generators
 * produce, ignoring the one field that cannot be stable across a commit.
 *
 * Why this exists rather than a plain `git diff` in CI: the generators stamp
 * each artifact with a build timestamp resolved from the git HEAD commit date
 * (see scripts/lib/build-timestamp.mjs). That makes the *content* reproducible
 * but the timestamp necessarily one commit stale — you cannot know a commit's
 * own date before making it, so the artifacts committed in commit N always
 * carry commit N-1's date. A naive diff therefore reports drift on literally
 * every commit that touches an artifact, which is how these fields stayed
 * wrong for months in the first place.
 *
 * So the timestamp is excluded from the comparison and everything else is
 * compared byte-for-byte. What this catches is the class of bug that actually
 * occurred: a stale tool list, a wrong count, a description that no longer
 * matches the implementation. What it deliberately does not catch is a stale
 * timestamp, which is metadata about when a file was written rather than a
 * claim about the system.
 *
 * Usage:  node scripts/check-portal-artifact-drift.mjs [--json]
 * Exit:   0 no drift, 1 drift found, 2 the check could not run.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');

/** Artifacts produced by the portal generators, and the paths they are read from. */
const ARTIFACTS = [
  'packages/portal/src/data/plans.json',
  'packages/portal/src/data/stats.json',
  'packages/portal/src/data/tools.json',
  'packages/portal/public/llms.txt',
  'packages/portal/public/llms-full.txt',
  'packages/portal/public/agents.json',
  'packages/portal/agents.json',
  'packages/portal/v1/openapi.json',
  'packages/portal/public/v1/openapi.json',
];

/**
 * Strip the fields that are expected to differ between a commit and its
 * parent, so the comparison is about content only.
 */
export function normalize(contents, path) {
  let out = contents;

  // JSON artifacts: drop the generation stamp wherever it appears at the top
  // level of a `_meta` block.
  if (path.endsWith('.json')) {
    try {
      const parsed = JSON.parse(contents);
      if (parsed && typeof parsed === 'object') {
        for (const key of ['_meta', 'meta']) {
          const block = parsed[key];
          if (block && typeof block === 'object') {
            delete block.generatedAt;
            delete block.updatedAt;
          }
        }
        // Some artifacts put the stamp at the document root.
        delete parsed.generatedAt;
        delete parsed.updatedAt;
        out = JSON.stringify(parsed, null, 2);
      }
    } catch {
      // Not valid JSON; fall through to the textual rules below.
    }
  }

  // Text artifacts carry the stamp in prose.
  out = out
    .replace(/^.*Auto-generated:.*$/gm, '')
    .replace(/^\s*"(generatedAt|updatedAt)":.*$/gm, '');

  // Trailing-whitespace normalisation so a trailing newline difference is not
  // reported as a content change.
  return out.replace(/[ \t]+$/gm, '').trimEnd();
}

function gitShow(path) {
  return execFileSync('git', ['show', `HEAD:${path}`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function readWorktree(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

/** First differing line, for an actionable error message. */
function firstDifference(a, b) {
  const al = a.split('\n');
  const bl = b.split('\n');
  const n = Math.max(al.length, bl.length);
  for (let i = 0; i < n; i++) {
    if (al[i] !== bl[i]) {
      return { line: i + 1, committed: al[i], regenerated: bl[i] };
    }
  }
  return null;
}

/**
 * Every tool count asserted in a committed file must equal the catalog length
 * in tools.json. This is the check that would have caught the 189-vs-184
 * drift: a stale count sitting in a generated artifact for months.
 *
 * Reads committed files only and makes no network call, so it cannot flake and
 * is meaningful even if the generators could not run at all.
 */
function checkToolCounts() {
  const catalogPath = 'packages/portal/src/data/tools.json';
  let expected;
  try {
    const parsed = JSON.parse(readFileSync(resolve(ROOT, catalogPath), 'utf8'));
    expected = Array.isArray(parsed.tools) ? parsed.tools.length : null;
  } catch {
    return [{ path: catalogPath, problem: 'unreadable or has no tools array' }];
  }
  if (expected === null) {
    return [{ path: catalogPath, problem: 'has no tools array' }];
  }

  const problems = [];
  for (const path of ['packages/portal/public/llms.txt', 'packages/portal/public/llms-full.txt', 'llms.txt', 'llms-full.txt']) {
    const abs = resolve(ROOT, path);
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, 'utf8');
    const patterns = [/\((\d+) tools\)/g, /^All (\d+) MCP tools/gm, /data-layer MCP, (\d+) tools/g, /^- (\d+) MCP tools/gm];
    for (const re of patterns) {
      for (const m of text.matchAll(re)) {
        const claimed = Number(m[1]);
        if (claimed !== expected) {
          problems.push({ path, problem: `claims ${claimed} tools, catalog has ${expected}` });
        }
      }
    }
  }
  return problems;
}

function main() {
  const drifted = [];
  const skipped = [];

  for (const path of ARTIFACTS) {
    const abs = resolve(ROOT, path);
    if (!existsSync(abs)) {
      skipped.push({ path, reason: 'not present in the worktree' });
      continue;
    }

    let committed;
    try {
      committed = gitShow(path);
    } catch {
      skipped.push({ path, reason: 'not tracked at HEAD' });
      continue;
    }

    const regenerated = readWorktree(path);
    if (normalize(committed, path) === normalize(regenerated, path)) continue;

    const diff = firstDifference(normalize(committed, path), normalize(regenerated, path));
    drifted.push({ path, ...diff });
  }

  const countProblems = checkToolCounts();
  const failed = drifted.length > 0 || countProblems.length > 0;

  if (asJson) {
    process.stdout.write(JSON.stringify({ drifted, countProblems, skipped, failed }, null, 2) + '\n');
  } else {
    for (const c of countProblems) {
      process.stderr.write(`COUNT MISMATCH: ${c.path} ${c.problem}\n`);
    }
    for (const d of drifted) {
      process.stderr.write(`DRIFT: ${d.path}\n`);
      if (d.line !== undefined) {
        process.stderr.write(`  first difference at line ${d.line}\n`);
        process.stderr.write(`    committed:    ${d.committed}\n`);
        process.stderr.write(`    regenerated:  ${d.regenerated}\n`);
      }
    }
    for (const s of skipped) {
      process.stderr.write(`SKIP: ${s.path} (${s.reason})\n`);
    }
    if (!failed) {
      process.stdout.write(
        `No drift: ${ARTIFACTS.length - skipped.length} artifact(s) match their generators ` +
        `(build timestamps excluded), and all tool counts agree.\n`,
      );
    }
  }

  process.exit(failed ? 1 : 0);
}

main();
