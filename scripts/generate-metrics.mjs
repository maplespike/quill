#!/usr/bin/env node
/**
 * generate-metrics.mjs — Deterministic metrics generator for MapleSpike
 *
 * Reads from source of truth (registry.ts, MCP tools dir, TS file tree)
 * and writes docs/metrics.json with fresh numbers.
 *
 * Usage: node scripts/generate-metrics.mjs
 *
 * The written file is a function of the source tree. Two things used to make
 * a fresh run differ from the committed file even when the counts did not:
 *
 * - `//_generated`, `version`, and `lastUpdated` were the wall-clock day, so
 *   the file drifted every UTC midnight.
 * - The module sentence (and, when the counts disagreed, the module count)
 *   changed when `packages/pipeline-core/dist/` happened to exist.
 *
 * Date fields are copied from the committed file when the rest of the
 * document is unchanged, and replaced with today only when a count changes.
 * The module count is the quoted `modulePath` entries in registry.ts. A
 * built `getAllModules()` that disagrees is reported on stderr and is not
 * written, so `git diff --exit-code docs/metrics.json` stays stable.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

/**
 * Count `.ts` files and their lines under `dir`.
 *
 * Skips `node_modules` and `dist`. Does not use `xargs wc`: on a package the
 * size of pipeline-core, xargs splits the file list and `tail -1` kept only
 * the last chunk (recorded as 78 lines, then 4,174, against ~156k real lines).
 *
 * A line is a newline-terminated row, plus a final row when the file does not
 * end in a newline. An empty file counts as one file and zero lines.
 */
/**
 * Quoted `modulePath` entries. Skips the unquoted `modulePath: string;`
 * field and full-line comments. A commented-out entry must not change the
 * published count.
 */
export function countQuotedModulePaths(registryContent) {
  let n = 0;
  for (const line of registryContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) continue;
    if (/modulePath:\s*['"]/.test(line)) n += 1;
  }
  return n;
}

/**
 * Count written into docs/metrics.json. Always the source literal count.
 * `runtimeCount` is accepted so a built dist can be checked, and ignored
 * when it disagrees — otherwise the committed file depends on who built.
 */
export function registryCountForMetrics(sourceCount, runtimeCount) {
  if (Number.isInteger(runtimeCount) && runtimeCount > 0 && runtimeCount !== sourceCount) {
    console.error(
      `generate-metrics: getAllModules()=${runtimeCount} but registry.ts has ${sourceCount} quoted modulePath entries. Writing ${sourceCount} so docs/metrics.json does not depend on dist/.`,
    );
  }
  return sourceCount;
}

const METRICS_DATE_FIELDS = ['//_generated', 'version', 'lastUpdated'];

function metricsPayload(doc) {
  const clone = { ...doc };
  for (const key of METRICS_DATE_FIELDS) delete clone[key];
  return JSON.stringify(clone);
}

/**
 * Keep the committed date stamp when the counts did not change.
 * `today` is `YYYY-MM-DD` and is used only when the payload differs.
 */
export function withStableDates(next, existing, today) {
  const reuse = !!existing
    && typeof existing === 'object'
    && metricsPayload(existing) === metricsPayload(next);
  const pick = (key) => (
    reuse && typeof existing[key] === 'string' && existing[key].length > 0
      ? existing[key]
      : today
  );
  return {
    ...next,
    '//_generated': pick('//_generated'),
    version: pick('version'),
    lastUpdated: pick('lastUpdated'),
  };
}

export function countTsFiles(dir) {
  let files = 0;
  let lines = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return { files: 0, lines: 0 };
  }
  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name === 'dist') continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      const sub = countTsFiles(p);
      files += sub.files;
      lines += sub.lines;
    } else if (ent.isFile() && ent.name.endsWith('.ts')) {
      files += 1;
      const text = readFileSync(p, 'utf8');
      if (text.length === 0) continue;
      const rows = text.split('\n');
      lines += text.endsWith('\n') ? rows.length - 1 : rows.length;
    }
  }
  return { files, lines };
}

async function generate() {
// ── 1. Registry count ────────────────────────────────────────
// Quoted modulePath literals in registry.ts. The file also declares an
// unquoted `modulePath: string;` interface field — counting it inflated
// the total by one (208 vs the true 207) until 2026-09-17.
// getAllModules() is consulted only to warn when a built dist disagrees.
// The written count does not change based on whether dist exists.
const registryPath = join(ROOT, 'packages/pipeline-core/src/ingestion/registry.ts');
const registryContent = readFileSync(registryPath, 'utf-8');
const sourceCount = countQuotedModulePaths(registryContent);
let runtimeCount = null;
try {
  const core = await import(join(ROOT, 'packages/pipeline-core/dist/index.js'));
  if (typeof core.getAllModules === 'function') {
    const mods = core.getAllModules();
    if (Array.isArray(mods) && mods.length > 0) runtimeCount = mods.length;
  }
} catch {
  // dist not built — source count stands alone
}
const registryCount = registryCountForMetrics(sourceCount, runtimeCount);

// ── 2. Ingestion subdirectories ──────────────────────────────
const ingestionDir = join(ROOT, 'packages/pipeline-core/src/ingestion');
const ingestionDirs = readdirSync(ingestionDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('__'))
  .length;

// ── 3. MCP tool definitions ──────────────────────────────────
// 2026-07-10: replaced the old grep-based counting with a text parse of the
// getAllTools() array literal + adapter spreads. The previous strategy
// (`grep -rl 'export const.*definition' packages/.../tools/*.ts | wc -l`)
// undercounted: multi-export adapter files (worldbank-wdi-modules.js,
// un-comtrade-modules.js) declare a single `definition` export but expose
// multiple tools, so the file count does not match the runtime
// registration. Runtime is what the user actually calls against.
const toolsIndexPath = join(ROOT, 'packages/quill-mcp/src/tools/index.ts');
const toolsIndexContent = readFileSync(toolsIndexPath, 'utf-8');

function countIdentifierLines(body) {
  let n = 0;
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) continue;
    if (t.startsWith('...')) continue; // spreads handled at call sites
    if (/^[a-zA-Z_]\w*(?:\.\w+)?,?$/.test(t)) n++;
  }
  return n;
}

const wrapStart = toolsIndexContent.indexOf('return wrapTools([');
const wrapEnd = wrapStart > -1 ? toolsIndexContent.indexOf(']);', wrapStart) : -1;
let getAllToolsCount = 0;
if (wrapStart > -1 && wrapEnd > -1) {
  getAllToolsCount = countIdentifierLines(
    toolsIndexContent.substring(wrapStart, wrapEnd)
  );
}

const wdiMatch = toolsIndexContent.match(/const wdiModules = \[([\s\S]*?)\];/);
const comtradeMatch = toolsIndexContent.match(
  /const comtradeModules = \[([\s\S]*?)\];/
);
const wdiCount = wdiMatch ? countIdentifierLines(wdiMatch[1]) : 0;
const comtradeCount = comtradeMatch
  ? countIdentifierLines(comtradeMatch[1])
  : 0;

const mcpToolCount = getAllToolsCount + wdiCount + comtradeCount;
const mcpToolDesc =
  `${getAllToolsCount} single-tool entries in getAllTools() + ${wdiCount} WDI adapter ` +
  `+ ${comtradeCount} Comtrade adapter = ${mcpToolCount} total tools registered at runtime ` +
  `(matches server.getToolCount() at startup in quill-mcp/src/cli.ts:269)`;

// ── 4. Detect packages ───────────────────────────────────────
const packagesDir = join(ROOT, 'packages');
const packageDirEntries = readdirSync(packagesDir, { withFileTypes: true })
  .filter(d => d.isDirectory());

const npmPackages = packageDirEntries
  .filter(d => {
    try {
      return statSync(join(packagesDir, d.name, 'package.json')).isFile();
    } catch {
      return false;
    }
  })
  .map(d => d.name)
  .sort();

const knownNonNpm = packageDirEntries
  .filter(d => d.name === 'sdk-python')
  .map(d => d.name);

const allPackages = [...new Set([...npmPackages, ...knownNonNpm])].sort();

// ── 5. TS files/lines per package ────────────────────────────
const perPackage = {};
for (const pkg of npmPackages) {
  const counted = countTsFiles(join(ROOT, 'packages', pkg));
  if (counted.files > 0) perPackage[pkg] = counted;
}

const overall = countTsFiles(join(ROOT, 'packages'));
const overallTsFiles = overall.files;
const overallTsLines = overall.lines;

// ── 6. Build output ──────────────────────────────────────────
const metricsPath = join(ROOT, 'docs/metrics.json');
const envDate = process.env.METRICS_DATE || '';
const today = /^\d{4}-\d{2}-\d{2}$/.test(envDate)
  ? envDate
  : new Date().toISOString().slice(0, 10);

let existing = null;
try {
  existing = JSON.parse(readFileSync(metricsPath, 'utf8'));
} catch {
  existing = null;
}

const metrics = withStableDates({
  '//': 'AUTO-GENERATED by scripts/generate-metrics.mjs - Run `node scripts/generate-metrics.mjs` to update.',
  '//_generated': today,
  version: today,
  modules: {
    registryCount,
    ingestionDirs,
    description: `${registryCount} modules registered (quoted modulePath entries in registry.ts). Includes attestation, gc-standards, cross-reference utilities. ${ingestionDirs} ingestion/ subdirectories with standalone fetch\u2192parse\u2192persist pipelines.`,
  },
  mcpTools: {
    count: mcpToolCount,
    description: mcpToolDesc,
  },
  typescript: {
    totalLines: overallTsLines,
    totalFiles: overallTsFiles,
    packages: allPackages.length,
    perPackage,
    note: 'Portal (HTML/CSS/JS), sdk-python (Python), pretext-civic (orphaned) not counted in TS totals.',
  },
  packages: {
    total: allPackages.length,
    names: allPackages,
  },
  externalEndpoints: {
    estimated: 1141,
    description: 'Estimated unique external data endpoints consumed across all modules',
  },
  lastUpdated: today,
}, existing, today);

// ── 7. Write metrics.json ────────────────────────────────────
writeFileSync(metricsPath, JSON.stringify(metrics, null, 2) + '\n');

console.log(`Modules: ${registryCount}, MCP Tools: ${mcpToolCount}, TS Files: ${overallTsFiles}, TS Lines: ${overallTsLines}`);
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  await generate();
}
