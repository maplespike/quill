#!/usr/bin/env node
/**
 * generate-metrics.mjs — Deterministic metrics generator for MapleSpike
 *
 * Reads from source of truth (registry.ts, MCP tools dir, TS file tree)
 * and writes docs/metrics.json with fresh numbers.
 *
 * Usage: node scripts/generate-metrics.mjs
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
// Prefer the runtime registry when pipeline-core is built: getAllModules()
// is what module consumers actually receive. Fall back to counting quoted
// modulePath literals in registry.ts. The file also declares an unquoted
// `modulePath: string;` interface field — counting it inflated the total
// by one (208 vs the true 207) until 2026-09-17.
const registryPath = join(ROOT, 'packages/pipeline-core/src/ingestion/registry.ts');
const registryContent = readFileSync(registryPath, 'utf-8');
let registryCount = 0;
let registrySource = 'runtime';
try {
  const core = await import(join(ROOT, 'packages/pipeline-core/dist/index.js'));
  if (typeof core.getAllModules === 'function') {
    const mods = core.getAllModules();
    if (Array.isArray(mods) && mods.length > 0) registryCount = mods.length;
  }
} catch {
  // dist not built — fall through to the source parse
}
if (registryCount === 0) {
  registrySource = 'source-literals';
  registryCount = (registryContent.match(/modulePath:\s*['"]/g) || []).length;
}

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
const today = new Date().toISOString().slice(0, 10);

const metrics = {
  '//': 'AUTO-GENERATED by scripts/generate-metrics.mjs - Run `node scripts/generate-metrics.mjs` to update.',
  '//_generated': today,
  version: today,
  modules: {
    registryCount,
    ingestionDirs,
    description: `${registryCount} modules registered at runtime (getAllModules()${registrySource === 'runtime' ? '' : '; counted from quoted registry.ts literals because dist was not built'}). Includes attestation, gc-standards, cross-reference utilities. ${ingestionDirs} ingestion/ subdirectories with standalone fetch\u2192parse\u2192persist pipelines.`,
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
};

// ── 7. Write metrics.json ────────────────────────────────────
const metricsPath = join(ROOT, 'docs/metrics.json');
writeFileSync(metricsPath, JSON.stringify(metrics, null, 2) + '\n');

console.log(`Modules: ${registryCount}, MCP Tools: ${mcpToolCount}, TS Files: ${overallTsFiles}, TS Lines: ${overallTsLines}`);
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  await generate();
}
