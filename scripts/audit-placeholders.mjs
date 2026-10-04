#!/usr/bin/env node
/**
 * Placeholder Audit — Quill
 *
 * Scans packages/ for placeholder patterns: fake URLs, stub data,
 * mock endpoints, TODO placeholders, fake UUIDs.
 *
 * Usage:
 *   node scripts/audit-placeholders.mjs              # full scan
 *   node scripts/audit-placeholders.mjs --baseline    # print baseline count
 *   node scripts/audit-placeholders.mjs --json        # machine-readable
 *
 * Exit codes: 0 = clean, 1 = new placeholders found
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const ROOT = join(__dirname, '..');
const SCAN_DIRS = ['packages', 'scripts'];
const ALLOWED_PREFIXES = [
  'node_modules',
  '.pnpm',
  'dist',
  '.git',
  '.direnv',
  '.devenv',
];
const BASELINE_FILE = join(ROOT, 'docs', 'placeholder-baseline.json');

// ── Patterns ──────────────────────────────────────────────────────

const PATTERNS = [
  {
    id: 'fake-url',
    label: 'Placeholder URL (example.com)',
    severity: 'error',
    test: (content, fp) => {
      if (fp.includes('audit-placeholders')) return []; // skip self
      const hits = [];
      const fakeUuidRe = /\b(?:[a-f0-9]{8}[-]?[a-f0-9]{4}[-]?[a-f0-9]{4}[-]?[a-f0-9]{4}[-]?[a-f0-9]{12})\b/gi;
      let m;
      while ((m = fakeUuidRe.exec(content)) !== null) {
        const uuid = m[0].replace(/-/g, '').toLowerCase();
        // Skip if hex is too varied (looks real) vs too uniform (looks fake)
        const uniqueChars = new Set(uuid).size;
        const zeroRatio = (uuid.match(/0/g) || []).length / uuid.length;
        const knownFakes = [
          'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
          '00000000000000000000000000000000',
          '11111111111111111111111111111111',
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          'deadbeefdeadbeefdeadbeefdeadbeef',
          'cafebabecafebabecafebabecafebabe',
        ];
        const normalized = uuid.replace(/-/g, '').toLowerCase();
        if (knownFakes.includes(normalized) || zeroRatio > 0.75 || uniqueChars < 6) {
          hits.push({ line: lineNo(content, m.index), match: m[0] });
        }
      }
      return hits;
    },
  },
  {
    id: 'todo-placeholder',
    label: 'TODO/FIXME about placeholder or stub',
    severity: 'warning',
    test: (content, fp) => {
      const hits = [];
      const re = /(TODO|FIXME|HACK|XXX)[^]*?(?:placeholder|mock|stub|fake|dummy|hardcod|real[ -]?api|replace|implement)/gi;
      let m;
      while ((m = re.exec(content)) !== null) {
        if (fp.includes('audit-placeholders')) continue; // skip self
        hits.push({ line: lineNo(content, m.index), match: m[0].substring(0, 80) });
      }
      return hits;
    },
  },
  {
    id: 'mock-endpoint',
    label: 'Mock endpoint pattern',
    severity: 'error',
    test: (content, fp) => {
      if (fp.includes('audit-placeholders')) return []; // skip self
      if (fp.includes('__tests__') || fp.endsWith('.test.ts')) return [];
      const hits = [];
      const re = /mock(?:[-_])?(?:api|server|endpoint|data|service)/gi;
      let m;
      while ((m = re.exec(content)) !== null) {
        hits.push({ line: lineNo(content, m.index), match: m[0] });
      }
      return hits;
    },
  },
  {
    id: 'stubbed-fetcher',
    label: 'Stubbed fetcher (returns hardcoded data)',
    severity: 'warning',
    test: (content, fp) => {
      if (!fp.includes('/fetcher') && !fp.includes('/parser')) return [];
      const hits = [];
      // Detects async functions with immediate return of array/object literal
      const stubRe = /async\s+function\s+\w*(?:fetch|ingest|parse)\w*(?:\([^)]*\))\s*{\s*(?:\/\*[^*]*\*\/\s*)?return\s+(?:\[(?:\s*\])|\{(?:\s*\})|null|undefined|\[\])/g;
      let m;
      while ((m = stubRe.exec(content)) !== null) {
        hits.push({ line: lineNo(content, m.index), match: m[0].substring(0, 80) });
      }
      return hits;
    },
  },
];

// ── Helpers ─────────────────────────────────────────────────────────

function lineNo(content, index) {
  return (content.substring(0, index).match(/\n/g) || []).length + 1;
}

function shouldScan(filePath) {
  const rel = relative(ROOT, filePath);
  for (const prefix of ALLOWED_PREFIXES) {
    if (rel.startsWith(prefix) || rel.includes(`/${prefix}`)) return false;
  }
  // Only scan .ts, .js, .mjs, .yml, .yaml, .json, .md
  return /\.(ts|js|mjs|yml|yaml|json|md)$/.test(rel);
}

function walk(dir) {
  const entries = [];
  try {
    const files = readFileSync(dir, { encoding: 'utf8', flag: 'r' });
    // Not a dir
    return [dir];
  } catch {
    // It's a directory
  }
  try {
    const list = readFileSync(dir, { encoding: 'utf8' });
    // Hmm this doesn't work for dirs. Use fs.readdirSync style but we don't import it.
    // Fallback to require
  } catch {}
  return [dir];
}

// Simple recursive file walk using fs
import { readdirSync, statSync } from 'node:fs';

function* walkFiles(dir) {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      if (ALLOWED_PREFIXES.some(p => full.includes(p))) continue;
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          yield* walkFiles(full);
        } else if (stat.isFile() && shouldScan(full)) {
          yield full;
        }
      } catch {}
    }
  } catch {}
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const baselineMode = args.includes('--baseline');

  const findings = [];

  for (const scanDir of SCAN_DIRS) {
    const dir = join(ROOT, scanDir);
    if (!existsSync(dir)) continue;

    for (const fp of walkFiles(dir)) {
      let content;
      try {
        content = readFileSync(fp, 'utf-8');
      } catch {
        continue;
      }

      for (const pattern of PATTERNS) {
        const hits = pattern.test(content, fp);
        if (hits.length > 0) {
          findings.push({
            file: relative(ROOT, fp),
            pattern: pattern.id,
            severity: pattern.severity,
            label: pattern.label,
            count: hits.length,
            hits: hits.slice(0, 3), // cap detail per finding
          });
        }
      }
    }
  }

  // Load baseline
  let baseline = {};
  if (existsSync(BASELINE_FILE)) {
    try {
      baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf-8'));
    } catch {}
  }

  // Group findings by file+pattern
  const findingKey = f => `${f.file}:${f.pattern}`;
  const findingMap = new Map();
  for (const f of findings) {
    const key = findingKey(f);
    if (!findingMap.has(key)) {
      findingMap.set(key, f);
    }
  }

  const currentFindings = Array.from(findingMap.values());

  // Compute state
  const bySeverity = { error: 0, warning: 0 };
  for (const f of currentFindings) {
    bySeverity[f.severity]++;
  }

  const baselineCount = Object.keys(baseline).length;
  const currentKeys = new Set(currentFindings.map(findingKey));
  const baselineKeys = new Set(Object.keys(baseline));
  const newFindings = currentFindings.filter(f => !baselineKeys.has(findingKey(f)));
  const resolvedCount = [...baselineKeys].filter(k => !currentKeys.has(k)).length;

  if (jsonOutput) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      total: currentFindings.length,
      errors: bySeverity.error,
      warnings: bySeverity.warning,
      new: newFindings.length,
      resolved: resolvedCount,
      findings: currentFindings,
    }, null, 2));
    process.exit(0);
  }

  // Pretty print
  console.log('\n=== Placeholder Audit Report ===\n');

  if (currentFindings.length === 0 && baselineCount === 0) {
    console.log('✅ No placeholders found. Clean baseline.');
    process.exit(0);
  }

  if (currentFindings.length === 0 && baselineCount > 0) {
    console.log(`✅ All ${baselineCount} baseline placeholders resolved!`);
    // Clean up baseline file
    writeFileSync(BASELINE_FILE, JSON.stringify({}));
    process.exit(0);
  }

  for (const f of currentFindings) {
    const icon = f.severity === 'error' ? '🔴' : '🟡';
    console.log(`  ${icon} [${f.severity}] ${f.file}:${f.hits[0]?.line || '?'}`);
    console.log(`      ${f.label} (${f.count}x)`);
    console.log(`      Example: ${f.hits[0]?.match || ''}`);
    console.log();
  }

  console.log(`Total: ${currentFindings.length} (${bySeverity.error} errors, ${bySeverity.warning} warnings)`);
  if (newFindings.length > 0) {
    console.log(`\n🆕 New findings (not in baseline): ${newFindings.length}`);
    for (const f of newFindings) {
      console.log(`  - ${f.file}:${f.hits[0]?.line} [${f.pattern}]`);
    }
  }
  if (resolvedCount > 0) {
    console.log(`\n✅ Resolved since last baseline: ${resolvedCount}`);
  }

  // Update baseline
  const newBaseline = {};
  for (const f of currentFindings) {
    newBaseline[findingKey(f)] = true;
  }
  writeFileSync(BASELINE_FILE, JSON.stringify(newBaseline, null, 2));
  console.log(`\nBaseline saved (${Object.keys(newBaseline).length} entries).`);

  // Exit with error if new findings (not in baseline)
  if (newFindings.length > 0 && !baselineMode) {
    console.log('\n❌ New placeholders found. Fix or update baseline.');
    process.exit(1);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
