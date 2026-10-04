/**
 * Placeholder Module Audit — Quill
 *
 * Scans all ingestion modules and flags those without structured parsers.
 * Used as a CI gate to prevent new metadata-only modules without parser issues.
 *
 * Run: node scripts/audit-placeholders.mjs
 * Exit codes: 0 = all good, 1 = placeholder modules found
 */

import { readdirSync, existsSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INGESTION_DIR = join(__dirname, '..', 'src', 'ingestion');

// Modules exempt from parser requirement (utility, cross-reference, external)
const EXEMPT = new Set(['attestation', 'gc-standards', 'templates', 'cross-reference', '__tests__']);

function hasParser(dir) {
  // Check for parser.ts at any depth
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== '__tests__' && entry.name !== 'node_modules') {
      if (hasParser(fullPath)) return true;
    } else if (entry.isFile() && entry.name === 'parser.ts') {
      return true;
    }
  }
  return false;
}

function hasStructuredExtraction(dir) {
  // Check for fetcher.ts with reasonable content
  const fetcherPath = join(dir, 'fetcher.ts');
  if (existsSync(fetcherPath) && statSync(fetcherPath).size > 500) return true;

  // Check for inline parsing: modules with 500+ lines and domain-specific .ts files
  // (not just constants/index/types) suggest real structured extraction
  let totalLines = 0;
  let domainFiles = 0;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      const fullPath = join(dir, entry.name);
      const lines = readFileSync(fullPath, 'utf-8').split('\n').length;
      totalLines += lines;
      // Count non-boilerplate files (not constants.ts, index.ts, types.ts, fetcher.ts)
      if (!['constants.ts', 'index.ts', 'types.ts', 'fetcher.ts'].includes(entry.name)) {
        domainFiles++;
      }
    }
  }

  // Module with 500+ lines and 1+ domain files = likely has structured extraction
  return totalLines >= 500 && domainFiles >= 1;
}

function main() {
  const modules = readdirSync(INGESTION_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const placeholders = [];

  for (const mod of modules) {
    if (EXEMPT.has(mod)) continue;
    const modDir = join(INGESTION_DIR, mod);
    if (!hasParser(modDir) && !hasStructuredExtraction(modDir)) {
      placeholders.push(mod);
    }
  }

  if (placeholders.length === 0) {
    console.log('✅ All modules have parsers or fetchers.');
    process.exit(0);
  }

  console.log(`⚠️  ${placeholders.length} modules flagged without parsers:\n`);
  for (const mod of placeholders) {
    console.log(`  ❌ ${mod}`);
  }
  console.log('\nSee docs/metadata-only-modules.md for per-domain tracking.');
  console.log('Each module should have a corresponding GitHub issue for parser implementation.\n');
  process.exit(1);
}

main();
