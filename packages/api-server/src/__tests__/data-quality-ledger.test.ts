/**
 * /v1/data/quality freshness, through the ingest ledger it is computed from.
 *
 * The API process never ingests, so pipeline-core's HealthMonitor is an empty
 * in-process singleton here and the ledger is the only source that can answer
 * "is this data current?" (that is why ingest-ledger.ts exists). This test
 * seeds one and pins that the report is computed from it — a report that
 * preferred the empty monitor would replace the ledger's success rate with 0
 * and call the source 'monitor', and both of those land here as failures.
 *
 * One `getDataQualityReport()` call costs a few seconds: the report HEAD-probes
 * every active module's health URL first (pre-existing behaviour, bounded by
 * the probe's own 5s abort).
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDataQualityReport, invalidateQualityCache } from '../data-quality.js';
import { getAllModules } from '../registry-snapshot.js';
import { recordIngest } from '../ingest-ledger.js';

const DIR = mkdtempSync(join(tmpdir(), 'quill-quality-'));
const LEDGER = join(DIR, 'ingest-ledger.json');
const SAVED_LEDGER = process.env.QUILL_INGEST_LEDGER;

after(() => {
  if (SAVED_LEDGER === undefined) delete process.env.QUILL_INGEST_LEDGER;
  else process.env.QUILL_INGEST_LEDGER = SAVED_LEDGER;
  invalidateQualityCache();
  rmSync(DIR, { recursive: true, force: true });
});

describe('data quality from the ingest ledger', () => {
  it('reports the ledger’s numbers, and nothing a monitor could invent', async () => {
    process.env.QUILL_INGEST_LEDGER = LEDGER;

    const active = getAllModules().filter((mod) => mod.status !== 'placeholder');
    assert.ok(active.length > 1, `the registry snapshot has only ${active.length} active module(s) to report on`);

    // One module that ran twice and failed once, one that never reported at
    // all, and the rest with a single successful run.
    const [flaky, never, ...healthy] = active;
    recordIngest({ module: flaky.name, status: 'success', records: 7 }, LEDGER);
    recordIngest({ module: flaky.name, status: 'failure', error: 'upstream 503' }, LEDGER);
    for (const mod of healthy) recordIngest({ module: mod.name, status: 'success', records: 7 }, LEDGER);

    const report = await getDataQualityReport();
    const row = (name: string) => {
      const found = report.modules.find((mod) => mod.moduleName === name);
      assert.ok(found, `${name} is missing from the report`);
      return found;
    };

    const flakyRow = row(flaky.name);
    assert.equal(flakyRow.totalRuns, 2);
    assert.equal(flakyRow.recordsFound, 7);
    assert.equal(flakyRow.successRate, 0.5, 'successRate must come from the ledger, not from an empty in-process monitor');
    assert.equal(flakyRow.freshnessSource, 'ledger');

    const neverRow = row(never.name);
    assert.equal(neverRow.successRate, 0);
    assert.equal(neverRow.totalRuns, 0);
    assert.equal(neverRow.freshnessSource, 'none');

    assert.equal(row(healthy[0].name).successRate, 1);

    assert.deepEqual(
      [...new Set(report.modules.map((mod) => mod.freshnessSource))].sort(),
      ['ledger', 'none'],
      'the only sources a report may cite are the ledger and nothing at all',
    );
  });
});
