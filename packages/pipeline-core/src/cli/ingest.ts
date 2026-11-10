#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Quill Ingestion Runner — K8s CronJob CLI entrypoint
 *
 * Reads QUILL_PIPELINE env var and dispatches to the correct
 * module via the ingestion registry.
 *
 * Usage:
 *   QUILL_PIPELINE=committees node dist/cli/ingest.js
 *   QUILL_PIPELINE=all node dist/cli/ingest.js
 *
 * Persistence contract lives in ./run-pipeline.ts: the runner passes NO
 * database handle to runModule(), so the registry injects the SQLite adapter
 * that honours QUILL_DB_PATH — the same file the API reads. Each run is also
 * recorded in `ingest_runs` so /v1/ingest/status can flag a stale pipeline.
 *
 * Environment:
 *   QUILL_PIPELINE           module alias (see PIPELINE_CONFIG) or "all"
 *   QUILL_DB_PATH            shared SQLite file (the API's /data/quill/quill.db)
 *   QUILL_INGEST_SCHEDULE    cron expression of the owning CronJob (staleness bound)
 *
 * Supported pipelines:
 *   committees, corporate, influence, gazette, gic,
 *   elections, provincial-lobbying, oversight, canlii, lmia,
 *   immigration, indigenous, defence, science, tribunals,
 *   veterans, fisheries, agriculture, culture, ngo-rss,
 *   regional-authorities, media, realtime, municipal-long-tail,
 *   universities, unions, corporate-filings, provincial, federal,
 *   a2aj, legislation, goc-spending, cross-reference, ati,
 *   cra-charity, criminal-justice, crown-corporations,
 *   education-research, federal-budget, geospatial,
 *   provincial-legislatures, provincial-orgs,
 *   provincial-regulators, social-programs, statcan,
 *   transport-infrastructure, all
 */

import { getModule, runAllModules } from '../ingestion/registry.js';
import { recordIngestRun, type IngestRunStatus } from '../ingestion/run-log.js';
import { citationStore } from '../claims/store.js';
import { countRecords, openDb, PIPELINE_CONFIG, runOne, SCHEDULE } from './run-pipeline.js';
import { reportIngest } from '../shared/ledger-report.js';

async function main() {
  const pipeline = process.env.QUILL_PIPELINE?.trim().toLowerCase() || 'help';

  if (pipeline === 'help') {
    console.log('Quill Ingestion Runner');
    console.log('Usage: QUILL_PIPELINE=<module> node dist/cli/ingest.js');
    console.log('\nAvailable modules:');
    for (const [alias, modName] of Object.entries(PIPELINE_CONFIG).sort()) {
      const mod = getModule(modName);
      if (mod) console.log(`  ${alias.padEnd(25)} ${mod.description}`);
    }
    console.log('  all                        Run all modules');
    process.exit(0);
  }

  const db = openDb();
  if (!db) process.exit(1);

  if (pipeline === 'all') {
    console.log('[CLI] Running ALL ingestion modules...');
    const startedAt = new Date();
    let claimsBefore = citationStore.size;
    const results = await runAllModules();
    let passed = 0;
    let failed = 0;
    let records = 0;
    let claimed = 0;

    for (const [name, result] of Object.entries(results)) {
      const error = (result as { error?: unknown })?.error;
      const status: IngestRunStatus = error ? 'failed' : 'success';
      if (error) failed++;
      else passed++;

      const moduleRecords = countRecords(result);
      const moduleClaims = Math.max(0, citationStore.size - claimsBefore);
      claimsBefore += moduleClaims;
      records += moduleRecords;
      claimed += moduleClaims;
      console.log(`  ${error ? '❌' : '✅'} ${name}: ${JSON.stringify(result).substring(0, 100)}`);

      recordIngestRun({
        pipeline: `all:${name}`,
        startedAt,
        finishedAt: new Date(),
        status,
        records: moduleRecords,
        claims: moduleClaims,
        schedule: SCHEDULE,
        error: error ? String(error) : null,
      });
    }

    recordIngestRun({
      pipeline: 'all',
      startedAt,
      finishedAt: new Date(),
      status: failed > 0 ? 'failed' : 'success',
      records,
      claims: claimed,
      schedule: SCHEDULE,
      error: failed > 0 ? `${failed} module(s) failed` : null,
    });

    // Record each module's outcome in the API freshness ledger. Best-effort:
    // reportIngest never throws, and a reporting failure must not fail the run.
    const allResults = (Array.isArray(results) ? results : []) as Array<Record<string, unknown>>;
    await Promise.all(
      allResults.map((rec) => {
        const name = String(rec['module'] ?? rec['name'] ?? rec['alias'] ?? 'unknown');
        const runFailed = rec['status'] === 'failed' || rec['status'] === 'failure' || rec['success'] === false;
        return reportIngest({
          module: name,
          status: runFailed ? 'failure' : 'success',
          records: Number(rec['records'] ?? rec['count'] ?? 0) || 0,
          ...(typeof rec['error'] === 'string' ? { error: rec['error'] } : {}),
        });
      }),
    );

    console.log(`\n[CLI] Done: ${passed} passed, ${failed} failed, ${records} records, ${claimed} claims`);
    process.exit(failed > 0 ? 1 : 0);
  }

  const moduleName = PIPELINE_CONFIG[pipeline];
  if (!moduleName) {
    console.error(`[CLI] Unknown pipeline: "${pipeline}"`);
    console.error('  Run without QUILL_PIPELINE to see available modules');
    process.exit(1);
  }

  if (!getModule(moduleName)) {
    console.error(`[CLI] Module "${moduleName}" not found in registry`);
    process.exit(1);
  }

  const outcome = await runOne(pipeline, moduleName, db);
  const out = outcome as unknown as Record<string, unknown>;
  await reportIngest({
    module: moduleName,
    status: outcome.status === 'success' ? 'success' : 'failure',
    records: Number(out['records'] ?? out['count'] ?? 0) || 0,
    ...(typeof out['error'] === 'string' ? { error: out['error'] } : {}),
  });
  process.exit(outcome.status === 'success' ? 0 : 1);
}

main().catch((err) => {
  console.error('[CLI] Fatal:', err);
  process.exit(1);
});
