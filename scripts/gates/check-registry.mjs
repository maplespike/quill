// Gate G3 oracle: assert the refreshed municipal registry only carries
// VALIDATED entries for the four keys flagged in issue #872.
// Usage: node scripts/gates/check-registry.mjs <registry.json>
import fs from 'node:fs';

const FLAGGED = [
  'https://data.winnipeg.ca|permits',
  'https://data.winnipeg.ca|budget',
  'https://data.edmonton.ca|building-permits',
  'https://data.edmonton.ca|budget',
];

const NEGATIVE_MARKERS = ['speed check sign', 'boundary', 'orthographic', 'photography', 'mosaic', 'map of'];

const path = process.argv[2];
if (!path || !fs.existsSync(path)) {
  console.error(`registry not found: ${path}`);
  process.exit(2);
}

let registry;
try {
  registry = JSON.parse(fs.readFileSync(path, 'utf8'));
} catch (err) {
  console.error(`registry is not valid JSON: ${err.message}`);
  process.exit(2);
}

const entries = registry.entries ?? {};
const problems = [];
let validatedCount = 0;

for (const key of FLAGGED) {
  const slug = key.split('|')[1];
  const entry = entries[key];
  if (!entry) {
    console.log(`  ${key}: absent (no validated candidate — acceptable only if none of the four validates)`);
    continue;
  }
  const name = String(entry.name ?? '');
  const rows = Number(entry.rowsProbed ?? 0);
  const lower = name.toLowerCase();

  if (!name) problems.push(`${key}: entry has no recorded dataset name`);
  if (NEGATIVE_MARKERS.some((m) => lower.includes(m))) {
    problems.push(`${key}: off-topic negative marker in "${name}"`);
  }
  const token = slug.split('-')[0];
  if (name && !lower.includes(token) && !(slug === 'budget' && /budget|financial|operating/.test(lower))) {
    problems.push(`${key}: name "${name}" does not match slug "${slug}"`);
  }
  if (rows <= 0) problems.push(`${key}: rowsProbed=${rows} (must be > 0)`);
  if (entry.validated !== true) problems.push(`${key}: entry not marked validated`);
  if (!problems.some((p) => p.startsWith(key))) {
    validatedCount++;
    console.log(`  ${key}: OK ("${name}", rows=${rows})`);
  }
}

// The refresh must demonstrably IMPROVE the four flagged keys — accepting a
// registry where all four are simply absent would be a vacuous pass.
if (validatedCount === 0) {
  problems.push('no flagged key carries a validated entry — refresh produced no positive evidence');
}

const total = Object.keys(entries).length;
console.log(`  registry entries: ${total}`);
if (problems.length) {
  console.error('registry validation: FAILED');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('registry validation: OK');
