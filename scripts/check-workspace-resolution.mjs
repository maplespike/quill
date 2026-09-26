#!/usr/bin/env node
// Injected-copy resolution guard (#859 class).
//
// Fails when a workspace package cannot be resolved from a consumer, or when
// resolution lands inside a stale pnpm *injected copy* of a workspace package
// that has no dist/. With inject-workspace-packages=true, `pnpm install`
// materialises copies of workspace deps under
// node_modules/.pnpm/<pkg>/node_modules/@maplespike/* BEFORE any build exists,
// and never refreshes them (pnpm #4407) — so ESM imports through those copies
// die with ERR_MODULE_NOT_FOUND. This broke CI four times (#859, Live Data
// Check, qa-module-validation/test-framework, attestation-chain) before
// scripts/build-packages.sh began repairing the copies post-build.
//
// Run from the repo root after `bash scripts/build-packages.sh`:
//   bash scripts/check-workspace-resolution.sh
// The logic is importable for tests: `checkResolution({root})` never executes
// package code and never shells out — it only reads files and resolves paths.
//
// Exit codes: 0 = every consumer/dep pair resolves to an existing entry and no
// stale injected copy remains; 1 = at least one failure (printed).

import { createRequire } from 'node:module';
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const REMEDY =
  'remedy: use scripts/build-packages.sh; do not call `pnpm --filter <pkg> build` alone';

// Workspace package dirs, derived from pnpm-workspace.yaml (packages section),
// falling back to packages/* when the yaml is missing or unparseable. Honours
// "!..." exclusion entries.
export function workspacePackageDirs(root) {
  const packagesDir = join(root, 'packages');
  if (!existsSync(packagesDir)) return [];
  const all = readdirSync(packagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  let include = null;
  const exclude = new Set();
  const yamlPath = join(root, 'pnpm-workspace.yaml');
  if (existsSync(yamlPath)) {
    let inPackages = false;
    for (const rawLine of readFileSync(yamlPath, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (/^packages:\s*$/.test(line)) {
        inPackages = true;
        continue;
      }
      if (inPackages && /^[A-Za-z-]+:/.test(line)) break; // next top-level key
      if (!inPackages || !line.startsWith('-')) continue;
      const pattern = line.replace(/^-\s*/, '').replace(/^["']|["']$/g, '');
      if (pattern.startsWith('!')) {
        exclude.add(pattern.slice(1).replace(/\/$/, ''));
      } else if (pattern === 'packages/*') {
        include = all;
      }
    }
  }
  const dirs = include ?? all;
  return dirs.filter((n) => !exclude.has(`packages/${n}`)).map((n) => join(packagesDir, n));
}

// The @maplespike/* dependencies + devDependencies declared by one consumer.
export function workspaceDepsOf(consumerDir) {
  const pkgPath = join(consumerDir, 'package.json');
  if (!existsSync(pkgPath)) return [];
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return [];
  }
  return Object.keys({
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  })
    .filter((k) => k.startsWith('@maplespike/'))
    .sort();
}

// Node-style package-dir lookup: nearest node_modules/<dep> walking up from
// consumerDir. Returns the path as linked (may be a symlink into the .pnpm
// store) — realpath it for the injected-copy analysis.
function findPackageDir(consumerDir, dep) {
  let dir = consumerDir;
  for (;;) {
    const cand = join(dir, 'node_modules', dep);
    if (existsSync(cand)) return cand;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// Resolve the root "." entry of an exports map using the ESM condition order
// Node applies to `import`: node → import → default. Strings, nested maps and
// subpath maps ("." first) are handled; anything unresolvable returns null.
function esmEntry(exportsMap) {
  const walk = (node, conditions) => {
    if (node == null) return null;
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = walk(item, conditions);
        if (found) return found;
      }
      return null;
    }
    if (typeof node !== 'object') return null;
    if (typeof node['.'] === 'string' || (node['.'] && typeof node['.'] === 'object')) {
      return walk(node['.'], conditions);
    }
    for (const cond of conditions) {
      if (node[cond] !== undefined) {
        const found = walk(node[cond], conditions);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(exportsMap, ['node', 'import', 'default', 'require', 'main']);
}

// True when realPkgDir is one of pnpm's *injected copies* of a workspace
// package: node_modules/.pnpm/<pkg>@…/node_modules/@maplespike/<pkg>.
function isStoreCopyDir(realPkgDir) {
  return /node_modules\/\.pnpm\/[^/]+\/node_modules\/@maplespike\/[^/]+$/.test(realPkgDir);
}

// Check every (consumer, dep) pair in the monorepo rooted at `root`.
// Pure inspection: reads package.json files, resolves specifiers, stats files.
// Returns { ok, checked, failures: [{consumer, dep, kind, resolved, message}] }.
export function checkResolution({ root }) {
  const absRoot = resolve(root);
  const consumers = [absRoot, ...workspacePackageDirs(absRoot)];
  const failures = [];
  let checked = 0;

  for (const consumerDir of consumers) {
    for (const dep of workspaceDepsOf(consumerDir)) {
      checked += 1;
      const consumerRel = relative(absRoot, consumerDir) || '.';

      // Primary resolution: createRequire, exactly as CI's node steps see CJS.
      const req = createRequire(join(consumerDir, 'index.js'));
      let resolved = null;
      let errCode = null;
      try {
        resolved = req.resolve(dep);
      } catch (e) {
        errCode = e?.code ?? 'ERR';
      }

      // Fallback for exports maps without a require condition (e.g.
      // @maplespike/pipeline-core exports only "import"): resolve the ESM
      // entry manually from the package dir node itself would import.
      if (!resolved && errCode === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
        const linkDir = findPackageDir(consumerDir, dep);
        if (linkDir) {
          const pkgJsonPath = join(linkDir, 'package.json');
          if (existsSync(pkgJsonPath)) {
            const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
            const entry = pkg.exports
              ? esmEntry(pkg.exports)
              : pkg.main ?? './index.js';
            if (entry) resolved = join(linkDir, entry.replace(/^\.\//, ''));
          }
        }
      }

      // Injected-copy analysis on the package dir the consumer links to.
      const linkDir = findPackageDir(consumerDir, dep);
      let realPkgDir = null;
      if (linkDir && existsSync(linkDir)) {
        try {
          realPkgDir = realpathSync(linkDir);
        } catch {
          realPkgDir = null;
        }
      }
      const storeCopy = realPkgDir ? isStoreCopyDir(realPkgDir) : false;
      const hasDist = realPkgDir ? existsSync(join(realPkgDir, 'dist')) : false;
      const resolvedExists = resolved ? existsSync(resolved) : false;

      if (storeCopy && !hasDist) {
        failures.push({
          consumer: consumerRel,
          dep,
          kind: 'injected-copy',
          resolved,
          message:
            `✗ ${consumerRel} → ${dep}\n` +
            `    resolved: ${resolved ? relative(absRoot, resolved) : `(unresolved: ${errCode})`}\n` +
            `    stale pnpm injected copy: ${relative(absRoot, realPkgDir)} has no dist/ —\n` +
            `    inject-workspace-packages=true materialised this copy at install time,\n` +
            `    before any build, and pnpm never refreshes it (pnpm #4407; #859 class).\n` +
            `    ${REMEDY}`,
        });
      } else if (!resolved) {
        failures.push({
          consumer: consumerRel,
          dep,
          kind: 'unresolved',
          resolved: null,
          message:
            `✗ ${consumerRel} → ${dep}\n` +
            `    could not resolve the dependency from this consumer (${errCode});\n` +
            `    the injected workspace copy may be missing or the exports map unusable.\n` +
            `    ${REMEDY}`,
        });
      } else if (!resolvedExists) {
        failures.push({
          consumer: consumerRel,
          dep,
          kind: 'missing-entry',
          resolved,
          message:
            `✗ ${consumerRel} → ${dep}\n` +
            `    resolved: ${relative(absRoot, resolved)} — the file does not exist.\n` +
            `    The package was never built, or resolution landed on a stale copy.\n` +
            `    ${REMEDY}`,
        });
      }
    }
  }

  return { ok: failures.length === 0, checked, failures };
}

// CLI entry: run the check, then the end-to-end smoke — the exact import path
// that broke CI — from packages/pipeline-core.
function main() {
  const root = process.cwd();
  const result = checkResolution({ root });

  let smokeFailure = null;
  const pipelineCore = join(root, 'packages', 'pipeline-core');
  if (result.ok && existsSync(pipelineCore)) {
    const smoke = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', "await import('@maplespike/database')"],
      { cwd: pipelineCore, encoding: 'utf8' },
    );
    if (smoke.status !== 0) {
      smokeFailure =
        `✗ end-to-end smoke: \`await import('@maplespike/database')\` from packages/pipeline-core exited ${smoke.status}\n` +
        `    ${(smoke.stderr ?? '').split('\n').find((l) => /Error|error/.test(l))?.trim() ?? ''}\n` +
        `    ${REMEDY}`;
    }
  }

  for (const f of result.failures) console.error(f.message);
  if (smokeFailure) console.error(smokeFailure);

  if (result.failures.length === 0 && !smokeFailure) {
    console.log(`✅ checked ${result.checked} consumer/dep pairs — all resolve to existing files`);
    process.exit(0);
  }
  console.error(
    `❌ ${result.failures.length + (smokeFailure ? 1 : 0)} failure(s) across ${result.checked} consumer/dep pairs`,
  );
  process.exit(1);
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
