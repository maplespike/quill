#!/usr/bin/env node
/**
 * Regenerate the source-family index inside DATA-LICENSES.md from
 * data-source-licenses.json.
 *
 * Deterministic: rows are sorted by id, and repeated runs are byte-identical.
 * The block rewritten is fenced by BEGIN/END GENERATED SOURCE INDEX markers.
 *
 * Usage:
 *   node scripts/generate-data-licenses.mjs          # rewrite the block
 *   node scripts/generate-data-licenses.mjs --check  # exit 1 on drift
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const BEGIN_MARKER = '<!-- BEGIN GENERATED SOURCE INDEX -->';
export const END_MARKER = '<!-- END GENERATED SOURCE INDEX -->';

/** Human labels for the enforced-policy flags shown in the index table. */
export const POLICY_LABELS = {
  commercialUse: 'non-commercial',
  discoveryOnly: 'discovery-only',
  linkOnly: 'link-only',
  aggregateOnly: 'aggregate-only',
  minimizePersonalInformation: 'pii-minimized',
  notOfficialVersion: 'not-official-version',
};

/** Labels for a family policy block (empty array when unflagged). */
export function policyLabels(policy) {
  if (!policy || typeof policy !== 'object') return [];
  const labels = [];
  for (const [flag, value] of Object.entries(policy)) {
    if (flag === 'commercialUse') {
      if (value === false) labels.push('non-commercial');
      continue;
    }
    if (value === true) labels.push(POLICY_LABELS[flag] ?? flag);
  }
  return labels;
}

/**
 * Render the markdown index table for every source family, sorted by id.
 * Families without a single recorded terms URL are labelled, not invented.
 */
export function buildIndexTable(sources) {
  const rows = [...sources].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const lines = [
    '| Source family | Publisher terms lead | Enforced policy |',
    '| --- | --- | --- |',
  ];
  for (const s of rows) {
    const terms = typeof s.source_terms === 'string' && s.source_terms.trim()
      ? s.source_terms.trim()
      : '_no single terms URL recorded — see the source family note_';
    const labels = policyLabels(s.policy);
    lines.push(`| \`${s.id}\` | ${terms} | ${labels.length ? labels.join(', ') : '—'} |`);
  }
  return lines.join('\n');
}

/** Replace the fenced generated block with freshly rendered content. */
export function renderLicenceFile(content, sources) {
  const start = content.indexOf(BEGIN_MARKER);
  const end = content.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error('DATA-LICENSES.md is missing the generated source-index markers');
  }
  const before = content.slice(0, start + BEGIN_MARKER.length);
  const after = content.slice(end);
  return `${before}\n\n${buildIndexTable(sources)}\n\n${after}`;
}

function main() {
  const licencesPath = resolve(ROOT, 'DATA-LICENSES.md');
  const jsonPath = resolve(ROOT, 'data-source-licenses.json');
  const content = readFileSync(licencesPath, 'utf8');
  const { sources } = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const rendered = renderLicenceFile(content, sources);
  const check = process.argv.includes('--check');

  if (rendered === content) {
    console.log('DATA-LICENSES.md source index is up to date');
    return;
  }
  if (check) {
    console.error('DATA-LICENSES.md source index is out of date — run: node scripts/generate-data-licenses.mjs');
    process.exit(1);
  }
  writeFileSync(licencesPath, rendered);
  console.log(`Updated DATA-LICENSES.md source index (${sources.length} families)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
