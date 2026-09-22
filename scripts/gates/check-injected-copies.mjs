#!/usr/bin/env node
/**
 * Regression guard for the injected-workspace-copy failure class.
 *
 * pnpm's `inject-workspace-packages=true` (.npmrc) materializes *copies* of
 * workspace deps inside the .pnpm store at `pnpm install` time — before any
 * dist/ exists — and never recopies them (pnpm #4407). A CI job that builds a
 * single package with `pnpm --filter <pkg> build` therefore leaves those
 * copies stale, and the first `node` step that executes a built workspace
 * import dies with ERR_MODULE_NOT_FOUND:
 *
 *   2026-09-22 qa.yml attestation-chain / qa-module-validation, run
 *   35677618009: `Cannot find module
 *   packages/pipeline-core/node_modules/@maplespike/database/dist/index.js
 *   imported from packages/pipeline-core/dist/claims/store.js`
 *
 * scripts/build-packages.sh repairs every injected leaf with a symlink to the
 * built packages/<pkg>. This check asserts that the repair actually happened,
 * so a future build-step edit cannot silently reintroduce the failure.
 *
 * Usage: node scripts/gates/check-injected-copies.mjs
 *   exit 0 -> "injected copies: OK (<n> leaves)"
 *   exit 1 -> lists every stale leaf and the entry file it fails to expose
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PACKAGES = join(ROOT, 'packages');

/** Entry file a consumer resolves for a package: `main`, else exports["."]. */
function declaredEntry(pkgDir) {
  try {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    const dot = pkg.exports && pkg.exports['.'];
    const entry =
      pkg.main ||
      (typeof dot === 'string' ? dot : dot && (dot.import || dot.default || dot.require));
    return typeof entry === 'string' ? entry : null;
  } catch {
    return null;
  }
}

/** Every `<store>/node_modules/@maplespike/<pkg>` leaf, i.e. one injected copy. */
function injectedLeaves() {
  const store = join(ROOT, 'node_modules', '.pnpm');
  if (!existsSync(store)) return [];
  const leaves = [];
  for (const entry of readdirSync(store)) {
    if (!entry.startsWith('@maplespike+')) continue;
    const scope = join(store, entry, 'node_modules', '@maplespike');
    if (!existsSync(scope)) continue;
    for (const name of readdirSync(scope)) {
      leaves.push({ name, path: join(scope, name) });
    }
  }
  return leaves;
}

const problems = [];
let checked = 0;

for (const leaf of injectedLeaves()) {
  const pkgDir = join(PACKAGES, leaf.name);
  const entry = declaredEntry(pkgDir);
  if (!entry) continue; // not a workspace package, or declares no main/exports

  checked += 1;
  if (!existsSync(join(leaf.path, entry))) {
    problems.push(`${leaf.path} does not expose ${entry}`);
  }
}

if (problems.length > 0) {
  console.error(`injected copies: ${problems.length} STALE of ${checked} checked`);
  console.error('');
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('');
  console.error('A build step that does not repair injected copies was used.');
  console.error('Fix: run `bash scripts/build-packages.sh` (builds all packages');
  console.error('and repairs every injected workspace leaf). A per-package');
  console.error('`pnpm --filter <pkg> build` leaves them stale — pnpm #4407.');
  process.exit(1);
}

if (checked === 0) {
  console.log(
    'injected copies: no leaves to check — node_modules/.pnpm has no @maplespike+* store entry ' +
      '(run `pnpm install`, or inject-workspace-packages was turned off)'
  );
  process.exit(0);
}

console.log(`injected copies: OK (${checked} leaves resolve their declared entry)`);
