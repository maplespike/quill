#!/usr/bin/env node
/**
 * Verify that pnpm-lock.yaml reflects the workspace manifests: every declared
 * dependency has an importer entry, and each recorded `specifier:` equals the
 * manifest specifier — except where a pnpm override (pnpm-workspace.yaml)
 * rewrites it, in which case the recorded value must equal the override
 * replacement and the override range must cover the manifest specifier.
 *
 * Decisive, offline, fail-closed: any range the mini-parser cannot interpret
 * denies the override excuse and fails the check.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lock = readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8');
const lines = lock.split('\n');

// ── discover workspace manifests (mirror pnpm-workspace.yaml) ──────────────
const wsRaw = existsSync(join(ROOT, 'pnpm-workspace.yaml'))
  ? readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8')
  : '';
const excluded = (wsRaw.match(/^\s*-\s*"!(packages\/[^"]+)"/gm) || []).map((m) =>
  m.replace(/^\s*-\s*"!/, '').replace(/"$/, '')
);
const manifests = [{ key: '.', path: join(ROOT, 'package.json') }];
const packagesDir = join(ROOT, 'packages');
for (const d of readdirSync(packagesDir, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  if (excluded.includes(`packages/${d.name}`)) continue;
  const p = join(packagesDir, d.name, 'package.json');
  if (existsSync(p)) manifests.push({ key: `packages/${d.name}`, path: p });
}

// ── overrides from pnpm-workspace.yaml ─────────────────────────────────────
// Shape: "name@range": "replacement" (single-quoted or double-quoted).
const overrides = [];
{
  const ovIdx = wsRaw.indexOf('overrides:');
  if (ovIdx !== -1) {
    const body = wsRaw.slice(ovIdx);
    for (const m of body.matchAll(/["']([^"']+)@([^"']+)["']:\s*["']([^"']+)["']/g)) {
      overrides.push({ name: m[1], keyRange: m[2], replacement: m[3] });
    }
  }
}

// ── minimal semver helpers (fail-closed) ───────────────────────────────────
const parseV = (s) => {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(s.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const cmp = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);

/** Range → {min,minStrict,max,maxStrict} or null if unparseable. Supports ^ ~ >= <= > < exact and AND-joins. */
function parseRange(range) {
  const r = range.trim();
  if (!r || r === '*' || r === 'latest') return null;
  if (r.startsWith('workspace:') || r.startsWith('link:') || r.startsWith('file:') || r.startsWith('catalog:')) {
    return 'SKIP';
  }
  let min = null, minStrict = false, max = null, maxStrict = false;
  const parts = r.split(/\s+/);
  try {
    for (const p of parts) {
      if (p.startsWith('^')) {
        const v = parseV(p.slice(1)); if (!v) return null;
        if (!min || cmp(v, min) > 0) { min = v; minStrict = false; }
        const hi = [v[0] + 1, 0, 0];
        if (!max || cmp(hi, max) < 0) { max = hi; maxStrict = true; }
      } else if (p.startsWith('~')) {
        const v = parseV(p.slice(1)); if (!v) return null;
        if (!min || cmp(v, min) > 0) { min = v; minStrict = false; }
        const hi = [v[0], v[1] + 1, 0];
        if (!max || cmp(hi, max) < 0) { max = hi; maxStrict = true; }
      } else if (p.startsWith('>=')) {
        const v = parseV(p.slice(2)); if (!v) return null;
        if (!min || cmp(v, min) > 0) { min = v; minStrict = false; }
      } else if (p.startsWith('>')) {
        const v = parseV(p.slice(1)); if (!v) return null;
        if (!min || cmp(v, min) > 0) { min = v; minStrict = true; }
      } else if (p.startsWith('<=')) {
        const v = parseV(p.slice(2)); if (!v) return null;
        if (!max || cmp(v, max) < 0) { max = v; maxStrict = false; }
      } else if (p.startsWith('<')) {
        const v = parseV(p.slice(1)); if (!v) return null;
        if (!max || cmp(v, max) < 0) { max = v; maxStrict = true; }
      } else if (/^\d/.test(p)) {
        const v = parseV(p); if (!v) return null;
        if (!min || cmp(v, min) > 0) { min = v; minStrict = false; }
        if (!max || cmp(v, max) < 0) { max = v; maxStrict = false; }
      } else {
        return null;
      }
    }
  } catch {
    return null;
  }
  if (!min) min = [0, 0, 0]; // only upper bounds given — range starts at 0
  return { min, minStrict, max, maxStrict };
}

/** Does the override key-range cover the manifest specifier's minimum version? */
function overrideCovers(keyRange, manifestSpec) {
  const key = parseRange(keyRange);
  const man = parseRange(manifestSpec);
  if (!key || !man || key === 'SKIP' || man === 'SKIP') return false;
  const lo = man.min;
  const c1 = cmp(lo, key.min);
  if (c1 < 0 || (c1 === 0 && key.minStrict)) return false;
  if (key.max) {
    const c2 = cmp(lo, key.max);
    if (c2 > 0 || (c2 === 0 && key.maxStrict)) return false;
  }
  return true;
}

// ── main check ─────────────────────────────────────────────────────────────
let checked = 0;
const problems = [];
const explained = [];

for (const { key, path } of manifests) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    problems.push(`${key}: package.json unreadable (${e.message})`);
    continue;
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies };
  if (Object.keys(deps).length === 0) continue; // pnpm omits empty importers

  const start = lines.findIndex(
    (l) => l === `  ${key}:` || l === `  '${key}':` || l === `  "${key}":`
  );
  if (start === -1) {
    problems.push(`${key}: importer block not found in pnpm-lock.yaml`);
    continue;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {2}\S/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const block = lines.slice(start, end).join('\n');

  for (const [name, spec] of Object.entries(deps)) {
    checked++;
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keyRe = new RegExp(`^ {6}('?)${esc(name)}\\1:\\n`, 'm');
    const m = block.match(keyRe);
    if (!m) {
      problems.push(`${key}: ${name}@${spec} (no lockfile entry)`);
      continue;
    }
    const window = block.slice(m.index, m.index + 400);
    const recordedRaw = /specifier: (.*)/.exec(window)?.[1]?.trim();
    const recorded = recordedRaw?.replace(/^['"]|['"]$/g, '');
    if (
      window.includes(`specifier: ${spec}`) ||
      window.includes(`specifier: '${spec}'`) ||
      window.includes(`specifier: "${spec}"`)
    ) {
      continue;
    }
    // Not an exact match — excused only by a covering override with the same replacement.
    const ov = overrides.find((o) => o.name === name && o.replacement === recorded);
    if (ov && overrideCovers(ov.keyRange, spec)) {
      explained.push(`${key}: ${name} manifest ${spec} → lockfile ${recorded} (override ${name}@${ov.keyRange})`);
      continue;
    }
    problems.push(`${key}: ${name}@${spec} (lockfile records: ${recordedRaw ?? 'unreadable'})`);
  }
}

if (problems.length > 0) {
  console.log(`lockfile spec check: FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
for (const e of explained) console.log(`  note: ${e}`);
console.log(
  `lockfile spec check: PASS (${manifests.length} importers, ${checked} specifiers, ${explained.length} override-explained)`
);
