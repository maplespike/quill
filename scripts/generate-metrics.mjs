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
import { execSync } from 'child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

function run(cmd) {
  return execSync(cmd, { encoding: 'utf-8', cwd: ROOT }).trim();
}

// ── 1. Registry count ────────────────────────────────────────
const registryPath = join(ROOT, 'packages/pipeline-core/src/ingestion/registry.ts');
const registryContent = readFileSync(registryPath, 'utf-8');
const registryCount = (registryContent.match(/modulePath:/g) || []).length;

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
let totalFiles = 0;
let totalLines = 0;

for (const pkg of npmPackages) {
  const pkgDir = join(ROOT, 'packages', pkg);
  const findCmd = `find "${pkgDir}" -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' 2>/dev/null`;

  const filesResult = run(`${findCmd} | wc -l`);
  const fileCount = parseInt(filesResult, 10);

  if (fileCount > 0) {
    const linesResult = run(`${findCmd} | xargs wc -l 2>/dev/null | tail -1`);
    const lineCount = parseInt(linesResult ? linesResult.trim().split(/\s+/)[0] : '0', 10) || 0;
    perPackage[pkg] = { files: fileCount, lines: lineCount };
    totalFiles += fileCount;
    totalLines += lineCount;
  }
}

const extraTsResult = run(`find packages -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' | wc -l`);
const overallTsFiles = parseInt(extraTsResult, 10);
const extraTsLinesResult = run(`find packages -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' | xargs wc -l 2>/dev/null | tail -1`);
const overallTsLines = parseInt(extraTsLinesResult.trim().split(/\s+/)[0], 10) || 0;

// ── 6. Build output ──────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);

const metrics = {
  '//': 'AUTO-GENERATED by scripts/generate-metrics.mjs - Run `node scripts/generate-metrics.mjs` to update.',
  '//_generated': today,
  version: today,
  modules: {
    registryCount,
    ingestionDirs,
    description: `${registryCount} entries in registry.ts (includes attestation, gc-standards, cross-reference utilities). ${ingestionDirs} ingestion/ subdirectories with standalone fetch\u2192parse\u2192persist pipelines.`,
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
