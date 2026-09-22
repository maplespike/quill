#!/usr/bin/env node
/**
 * ci-lane-guard — CI workflow lanes that import a *built* workspace package at
 * runtime must run `bash scripts/build-packages.sh` first.
 *
 * Why (incident class #859, recurred 2026-09-22 in QA run 35678550390):
 * this repo sets `inject-workspace-packages=true` (.npmrc), so pnpm materializes
 * *injected copies* of every workspace dependency inside the store package's
 * node_modules at `pnpm install` time — BEFORE any `dist/` exists. Those copies
 * are never recopied, so a lane that runs `pnpm --filter <pkg> build` and then
 * imports `@maplespike/<dep>` at runtime dies with ERR_MODULE_NOT_FOUND:
 *
 *   Error [ERR_MODULE_NOT_FOUND]: Cannot find module
 *   '.../packages/pipeline-core/node_modules/@maplespike/database/dist/index.js'
 *
 * `scripts/build-packages.sh` builds every package in topological order AND
 * repairs the injected copies (symlink to the real `packages/<p>`), which is
 * why test-framework, qa-module-validation, live-data-check and publish all
 * call it. This guard fails the build when a new lane forgets it.
 *
 * Rules enforced per job:
 *   1. A job whose steps import `@maplespike/*` at runtime (ESM `from`,
 *      `require()`, dynamic `import()`) must run `bash scripts/build-packages.sh`.
 *   2. That build step must come BEFORE the importing step.
 *
 * Escape hatch: add `# ci-lane-guard: allow-no-build` with a reason.
 *
 * Usage: node scripts/check-ci-build-lanes.mjs [repo-root]
 * Exit 0 = all lanes OK, 1 = at least one lane violates a rule.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..');

export const SHARED_BUILD = 'scripts/build-packages.sh';
export const WAIVER = 'ci-lane-guard: allow-no-build';

const IMPORT_RE =
  /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*)['"](@maplespike\/[A-Za-z0-9._/-]+)['"]/g;
const SHARED_BUILD_RE = /bash\s+scripts\/build-packages\.sh/;
const FILTERED_BUILD_RE = /pnpm\s+--filter\s+(@maplespike\/[A-Za-z0-9-]+)\s+build\b/g;
const WAIVER_RE = /ci-lane-guard:\s*allow-no-build/;

/**
 * Split a workflow file into jobs. Bad enough YAML knowledge to be safe:
 * job ids sit at 2-space indentation under the top-level `jobs:` key.
 * @returns {{name: string, startLine: number, lines: {n: number, text: string}[]}[]}
 */
export function parseJobs(text) {
  const lines = text.split('\n');
  const jobs = [];
  let inJobs = false;
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inJobs) {
      if (/^jobs:\s*$/.test(line)) inJobs = true;
      continue;
    }
    if (line.trim() !== '' && !/^\s/.test(line)) {
      inJobs = false;
      current = null;
      continue;
    }
    const m = /^ {2}([A-Za-z0-9_.-]+):\s*$/.exec(line);
    if (m) {
      current = { name: m[1], startLine: i + 1, lines: [] };
      jobs.push(current);
      continue;
    }
    if (current) current.lines.push({ n: i + 1, text: line });
  }
  return jobs;
}

function matchAll(re, text) {
  re.lastIndex = 0;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

/**
 * Check one workflow file's text.
 * @returns {{file: string, job: string, line: number, message: string}[]}
 */
export function checkWorkflowText(text, file = '<inline>') {
  const problems = [];
  for (const job of parseJobs(text)) {
    const body = job.lines.map((l) => l.text).join('\n');
    if (WAIVER_RE.test(body)) continue;

    const importHits = [];
    for (const line of job.lines) {
      for (const pkg of matchAll(IMPORT_RE, line.text)) {
        importHits.push({ n: line.n, pkg });
      }
    }
    if (importHits.length === 0) continue;

    const packages = [...new Set(importHits.map((h) => h.pkg))].join(', ');
    const firstImport = importHits[0].n;
    const filtered = matchAll(FILTERED_BUILD_RE, body);

    const buildLines = job.lines.filter((l) => SHARED_BUILD_RE.test(l.text)).map((l) => l.n);
    if (buildLines.length === 0) {
      problems.push({
        file,
        job: job.name,
        line: firstImport,
        message:
          `imports ${packages} at runtime but never runs "bash ${SHARED_BUILD}"; ` +
          (filtered.length > 0
            ? `per-package build alone (${filtered.join(', ')}) leaves pnpm's injected copies of workspace deps without dist/ (ERR_MODULE_NOT_FOUND, #859 class)`
            : 'no build step found, so the built dist these imports resolve to may not exist'),
      });
      continue;
    }

    const firstBuild = Math.min(...buildLines);
    if (firstBuild > firstImport) {
      problems.push({
        file,
        job: job.name,
        line: firstImport,
        message:
          `imports ${packages} at line ${firstImport} but runs "bash ${SHARED_BUILD}" only at line ${firstBuild}; ` +
          'the build must come first',
      });
    }
  }
  return problems;
}

/**
 * Check every workflow under `<root>/.github/workflows`.
 * @returns {{file: string, job: string, line: number, message: string}[]}
 */
export function checkRepo(root = REPO_ROOT) {
  const dir = path.join(root, '.github', 'workflows');
  if (!fs.existsSync(dir)) {
    return [{ file: dir, job: '-', line: 1, message: 'no .github/workflows directory' }];
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .sort();
  const problems = [];
  for (const f of files) {
    problems.push(...checkWorkflowText(fs.readFileSync(path.join(dir, f), 'utf8'), `.github/workflows/${f}`));
  }
  return problems;
}

export function countJobs(root = REPO_ROOT) {
  const dir = path.join(root, '.github', 'workflows');
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    : [];
  let jobs = 0;
  for (const f of files) jobs += parseJobs(fs.readFileSync(path.join(dir, f), 'utf8')).length;
  return { files: files.length, jobs };
}

export function main(argv = process.argv.slice(2)) {
  const root = argv[0] ? path.resolve(argv[0]) : REPO_ROOT;
  const problems = checkRepo(root);
  const { files, jobs } = countJobs(root);
  if (problems.length === 0) {
    console.log(
      `ci-lane-guard: PASS — ${jobs} job(s) in ${files} workflow file(s); ` +
        'every runtime workspace-dist import is preceded by scripts/build-packages.sh',
    );
    return 0;
  }
  for (const p of problems) {
    console.error(`::error file=${p.file},line=${p.line}::[${p.job}] ${p.message}`);
    console.error(`ci-lane-guard: FAIL — ${p.file} job '${p.job}': ${p.message}`);
  }
  console.error(`ci-lane-guard: ${problems.length} violating lane(s) — see ${SHARED_BUILD}`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
