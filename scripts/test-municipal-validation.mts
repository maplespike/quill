// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Gate G2 fixtures for the municipal candidate validator (#872).
 * Negative controls are the EXACT live failures reported on 2026-09-21.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

import {
  validateCandidate,
  topicFits,
  slugTokens,
} from './lib/municipal-candidate-validation.js';

// ── Negative controls (must reject) ───────────────────────────────────

test('rejects Winnipeg "Map of Downtown Boundary" for |permits|', () => {
  const r = validateCandidate('permits', { name: 'Map of Downtown Boundary', id: '2df6-k8j2' }, 0);
  assert.equal(r.ok, false, 'a map with no rows must not pass as permits');
  assert.equal(r.topicFit, false);
});

test('rejects Edmonton "Speed Check Sign - DFS283" for building-permits', () => {
  const r = validateCandidate('building-permits', { name: 'Speed Check Sign - DFS283', id: 'y9xt-s3ub' }, 0);
  assert.equal(r.ok, false, 'an unrelated sign dataset must not pass as building permits');
});

test('rejects a topically-correct dataset that returns zero rows', () => {
  const r = validateCandidate('permits', { name: 'Building Permits 2024', id: 'abcd-1234' }, 0);
  assert.equal(r.ok, false, 'zero rows must fail even with a matching title');
  assert.equal(r.topicFit, true);
  assert.equal(r.rowsPresent, false);
});

test('rejects an unprobed candidate (probe could not run)', () => {
  const r = validateCandidate('budget', { name: 'Operating Budget', id: 'abcd-5678' }, -1);
  assert.equal(r.ok, false, 'unprobed candidates must not be written to the registry');
});

test('rejects negative markers even when a slug token appears', () => {
  assert.equal(topicFits('housing', 'Map of Housing Orthographic Photography Mosaic'), false);
  assert.equal(topicFits('permits', 'Boundary Map — permit office locations'), false);
});

// ── Positive controls (must accept) ───────────────────────────────────

test('accepts a CKAN candidate on topic fit alone (no cheap row endpoint)', () => {
  const r = validateCandidate('permits', { name: 'Building Permits', id: 'ckan-0001' }, null, 'ckan');
  assert.equal(r.ok, true, 'CKAN package ids have no row probe — topic fit decides');
});

test('accepts a real permits dataset with rows', () => {
  const r = validateCandidate('permits', { name: 'Building Permits', id: 'good-0001' }, 1);
  assert.equal(r.ok, true);
});

test('accepts budget via synonym vocabulary ("Operating Budget")', () => {
  const r = validateCandidate('budget', { name: 'Operating Budget', id: 'good-0002' }, 5);
  assert.equal(r.ok, true);
});

test('accepts a CKAN-style name containing the slug token', () => {
  const r = validateCandidate('transit', { name: 'Transit GTFS Schedule', id: 'good-0003' }, 1);
  assert.equal(r.ok, true);
});

// ── Mechanics ─────────────────────────────────────────────────────────

test('slugTokens splits composite slugs', () => {
  assert.deepEqual(slugTokens('building-permits'), ['building', 'permits']);
  assert.deepEqual(slugTokens('permits'), ['permits']);
});

test('reason strings are populated for rejections', () => {
  const r = validateCandidate('permits', { name: 'Map of Downtown Boundary', id: '2df6-k8j2' }, 0);
  assert.ok(r.reason.length > 10, 'rejection must carry a reason for the run log');
});


// ─── Live-registry regression + oracle cross-check (2026-09-22) ─────────────
// The 21:06 refresh wrote a registry and THEN reported "FAILED", and the gate
// oracle and the validator implemented topic matching separately — the oracle
// folded plurals while the validator relied on its synonym table. These tests
// pin both: the real names must validate, and the oracle must agree with the
// validator on them. Drift now fails in CI instead of in a gate.
const LIVE_NAMES: Array<[host: string, slug: string, name: string]> = [
  ['https://data.winnipeg.ca', 'permits', 'Detailed Building Permit Data'],
  ['https://data.winnipeg.ca', 'budget', 'Capital Budget - 2014'],
  ['https://data.edmonton.ca', 'building-permits', 'General Building Permits'],
  ['https://data.edmonton.ca', 'budget', '2012 Budget Consultation Survey - Taxes And Balancing Budget'],
];

test('the four live registry names validate (incl. singular "Permit" for the "permits" slug)', () => {
  for (const [, slug, name] of LIVE_NAMES) {
    assert.equal(topicFits(slug, name), true, `${slug} must accept "${name}"`);
    const verdict = validateCandidate(slug, { name, id: 'probe-id' }, 1);
    assert.equal(verdict.ok, true, `${slug} + "${name}" + 1 row must validate (${verdict.reason})`);
  }
});

function oracleVerdict(entries: Record<string, unknown>): number {
  const tmp = `/tmp/registry-oracle-check-${process.pid}.json`;
  fs.writeFileSync(tmp, JSON.stringify({ entries }, null, 2), 'utf8');
  const r = spawnSync(process.execPath, [new URL('./gates/check-registry.mjs', import.meta.url).pathname, tmp], {
    encoding: 'utf8',
  });
  fs.rmSync(tmp, { force: true });
  return r.status ?? 2;
}

test('the gate oracle agrees with the validator on those four names (no drift)', () => {
  const entries = Object.fromEntries(
    LIVE_NAMES.map(([host, slug, name]) => [`${host}|${slug}`, { name, id: 'probe-id', rowsProbed: 1, validated: true }]),
  );
  assert.equal(oracleVerdict(entries), 0, 'the oracle must accept a registry the validator accepts');
});

test('the oracle still rejects a known-bad name (the cross-check can fail)', () => {
  const entries = Object.fromEntries(
    LIVE_NAMES.map(([host, slug, name]) => [`${host}|${slug}`, { name, id: 'probe-id', rowsProbed: 1, validated: true }]),
  );
  entries['https://data.winnipeg.ca|permits'] = {
    name: 'Map of Downtown Boundary',
    id: 'probe-id',
    rowsProbed: 1,
    validated: true,
  };
  assert.notEqual(oracleVerdict(entries), 0, 'the oracle must reject the map false-positive');
});
