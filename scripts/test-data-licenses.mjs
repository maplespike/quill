#!/usr/bin/env node
/**
 * Data-licence inventory checks (node --test).
 *
 * 1. data-source-licenses.json invariants: unique ids, the recorded
 *    no_quill_reuse_grant decision, a review note per family, and recorded
 *    terms leads that are absolute https URLs.
 * 2. DATA-LICENSES.md: the generated source index lists every family exactly
 *    once and matches the generator output (no drift).
 * 3. Required notices: the OGL–Canada and lobbying attribution statements,
 *    the Statistics Canada notices, the parliamentary copyright/financial-gain
 *    conditions, the RFLO condition, and the non-endorsement disclaimer are
 *    all present in DATA-LICENSES.md.
 *
 * Incident rule: a licence statement or notice cannot be removed from
 * DATA-LICENSES.md without this test failing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderLicenceFile } from './generate-data-licenses.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sources = JSON.parse(readFileSync(resolve(ROOT, 'data-source-licenses.json'), 'utf8')).sources;
const licences = readFileSync(resolve(ROOT, 'DATA-LICENSES.md'), 'utf8');

test('source-family entries have unique ids', () => {
  const ids = sources.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate source-family id');
});

test('every entry records the non-grant decision and a review note', () => {
  for (const s of sources) {
    assert.equal(s.reuse_decision, 'no_quill_reuse_grant', `${s.id}: unexpected reuse decision`);
    assert.ok(typeof s.note === 'string' && s.note.length > 20, `${s.id}: missing review note`);
  }
});

test('recorded publisher terms leads are absolute https URLs', () => {
  for (const s of sources) {
    if (s.source_terms) {
      assert.match(s.source_terms, /^https:\/\/[^\s]+$/, `${s.id}: source_terms is not an https URL`);
    }
  }
});

test('DATA-LICENSES.md source index lists every family exactly once', () => {
  for (const s of sources) {
    const occurrences = licences.split('`' + s.id + '`').length - 1;
    assert.equal(occurrences, 1, `${s.id}: expected exactly one index row, found ${occurrences}`);
  }
});

test('DATA-LICENSES.md source index matches the generator output', () => {
  const rendered = renderLicenceFile(licences, sources);
  assert.equal(rendered, licences, 'index drift — run node scripts/generate-data-licenses.mjs');
});

test('required licence statements and notices are documented', () => {
  const required = [
    'Contains information licensed under the Open Government Licence – Canada.',
    'Contains information licensed under the Open Data Licence Agreement — Office of the Commissioner of Lobbying.',
    'Reproduced and distributed on an "as is" basis with the permission of Statistics Canada.',
    'This does not constitute an endorsement by Statistics Canada of this product.',
    'does not extend to reproduction, distribution or use for commercial purpose of financial gain',
    'not extend to any use for purposes of financial gain',
    'not represented as an official version',
    'Not affiliated with or endorsed by the Government of Canada.',
    'not legal advice',
  ];
  for (const r of required) {
    assert.ok(licences.includes(r), `DATA-LICENSES.md is missing required text: ${r}`);
  }
});
