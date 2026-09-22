// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Gate G2 fixtures for the municipal candidate validator (#872).
 * Negative controls are the EXACT live failures reported on 2026-09-21.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

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
