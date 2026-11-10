// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Ingestion Pipeline Runner
 *
 * Runs a single ingestion pipeline by module name.
 * Called by the ingestion CronJob container with QUILL_PIPELINE env.
 * Persists results to PostgreSQL when DATABASE_URL is set.
 *
 * Usage:
 *   node packages/pipeline-core/dist/ingestion/run-pipeline.js --name=committees
 *   node packages/pipeline-core/dist/ingestion/run-pipeline.js --name=realtime --limit=5
 *
 * Env:
 *   QUILL_PIPELINE  — module name to run (required)
 *   DATABASE_URL          — PostgreSQL connection string (optional; skips persistence if absent)
 *   NODE_ENV              — defaults to 'production'
 *   JWT_SECRET            — required for API calls (set in k8s secrets)
 */

import { runModule, getModule, getAllModules, healthCheckModule } from './registry.js';
import { probeAll } from './change-detect.js';
import { probeUrlsFor } from './probe-urls.js';
import type { ModuleCategory } from './registry.js';

/**
 * Pipeline alias map.
 * Maps CronJob pipeline names (QUILL_PIPELINE) to registry module names.
 * Kept in sync with cli/ingest.ts PIPELINE_CONFIG.
 */
const PIPELINE_CONFIG: Record<string, string> = {
  committee: 'committees',
  corporate: 'corporate',
  influence: 'influence',
  gazette: 'gazette',
  gic: 'gic',
  elections: 'elections',
  'provincial-lobbying': 'provincial-lobbying',
  oversight: 'oversight',
  canlii: 'canlii',
  lmia: 'lmia',
  indigenous: 'indigenous',
  defence: 'defence',
  immigration: 'immigration',
  tribunals: 'federal-tribunals',
  veterans: 'veterans',
  fisheries: 'fisheries',
  agriculture: 'agriculture',
  culture: 'culture',
  'ngo-rss': 'ngo-influence-rss',
  'regional-authorities': 'regional-authorities',
  media: 'media-broadcasting',
  realtime: 'real-time-feeds',
  'municipal-long-tail': 'municipal-long-tail',
  universities: 'universities',
  unions: 'unions',
  'corporate-filings': 'corporate-filings',
  provincial: 'provincial',
  federal: 'federal',
  a2aj: 'a2aj',
  legislation: 'legislation',
  'goc-spending': 'goc-spending',
  'cross-reference': 'cross-reference',
  ati: 'ati',
  'cra-charity': 'cra-charity',
  'criminal-justice': 'criminal-justice',
  'crown-corporations': 'crown-corporations',
  'education-research': 'education-research',
  'federal-budget': 'federal-budget',
  geospatial: 'geospatial',
  'provincial-legislatures': 'provincial-legislatures',
  'provincial-orgs': 'provincial-orgs',
  'provincial-regulators': 'provincial-regulators',
  'social-programs': 'social-programs',
  statcan: 'statcan',
  'transport-infrastructure': 'transport-infrastructure',
};

interface IngestionRecord {
  id: string;
  pipeline_name: string;
  category: ModuleCategory;
  source: string;
  records_count: number;
  summary: string;
  status: 'success' | 'failed' | 'skipped';
  error_message: string | null;
  duration_ms: number;
}

async function getPgPool() {
  const { default: pg } = await import('pg');
  const connStr = process.env.DATABASE_URL || (() => {
    const host = process.env.QUILL_DB_HOST || 'localhost';
    const port = process.env.QUILL_DB_PORT || '5432';
    const db   = process.env.QUILL_DB_NAME || 'maplespike';
    const user = process.env.QUILL_DB_USER || 'maplespike';
    const pass = process.env.QUILL_DB_PASSWORD || '';
    return `postgresql://${user}:${pass}@${host}:${port}/${db}`;
  })();
  const pool = new pg.Pool({ connectionString: connStr, max: 5 });
  pool.on('error', (err: Error) => {
    console.error('[ingestion] PG pool error:', err.message);
  });
  return pool;
}

async function ensureIngestionLogTable(pool: import('pg').Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ingestion_log (
        id TEXT PRIMARY KEY,
        pipeline_name TEXT NOT NULL,
        category TEXT NOT NULL,
        source TEXT NOT NULL,
        records_count INTEGER NOT NULL DEFAULT 0,
        summary TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'success',
        error_message TEXT,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ingestion_log_pipeline ON ingestion_log(pipeline_name);
      CREATE INDEX IF NOT EXISTS idx_ingestion_log_started ON ingestion_log(started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ingestion_log_status ON ingestion_log(status);
    `);
  } finally {
    client.release();
  }
}

async function persistResult(
  pool: import('pg').Pool,
  record: IngestionRecord,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO ingestion_log (id, pipeline_name, category, source, records_count, summary, status, error_message, duration_ms)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        records_count = EXCLUDED.records_count,
        summary = EXCLUDED.summary,
        status = EXCLUDED.status,
        error_message = EXCLUDED.error_message,
        duration_ms = EXCLUDED.duration_ms,
        completed_at = NOW()
    `, [
      record.id,
      record.pipeline_name,
      record.category,
      record.source,
      record.records_count,
      record.summary,
      record.status,
      record.error_message,
      record.duration_ms,
    ]);
  } finally {
    client.release();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const nameFlag = args.find(a => a.startsWith('--name='));
  const limitFlag = args.find(a => a.startsWith('--limit='));
  const pipelineName = nameFlag?.split('=')[1] || process.env['QUILL_PIPELINE'];
  const limit = limitFlag ? parseInt(limitFlag.split('=')[1], 10) : undefined;

  if (!pipelineName) {
    console.error('ERROR: No pipeline name provided. Set QUILL_PIPELINE env or pass --name=<module>.');
    const all = getAllModules();
    console.error(`Available modules: ${all.length} total, ${all.filter(m => m.status !== 'placeholder').length} active`);
    process.exit(1);
  }

  // Resolve alias → registry module name
  const moduleName = PIPELINE_CONFIG[pipelineName] || pipelineName;
  if (moduleName !== pipelineName) {
    console.log(`[ingestion] Alias '${pipelineName}' → '${moduleName}'`);
  }

  const module = getModule(moduleName);
  if (!module) {
    console.error(`ERROR: Module '${moduleName}' not found in registry.`);
    process.exit(1);
  }

  if (module.status === 'placeholder') {
    console.warn(`SKIP: Module '${moduleName}' is a placeholder — no implementation to run.`);
    process.exit(0);
  }

  console.log(`[ingestion] Starting pipeline: ${moduleName}`);
  console.log(`[ingestion] Description: ${module.description}`);
  console.log(`[ingestion] Category: ${module.category}`);
  console.log(`[ingestion] Sources: ${module.sources.map(s => s.name).join(', ')}`);
  console.log(`[ingestion] Update frequency: ${module.updateFrequency}`);
  console.log(`[ingestion] Limit: ${limit ?? 'default'}`);

  // Determine if we have DB persistence
  const hasDb = !!(process.env.DATABASE_URL || process.env.QUILL_DB_HOST);
  let pool: import('pg').Pool | null = null;
  if (hasDb) {
    try {
      pool = await getPgPool();
      await ensureIngestionLogTable(pool);
      console.log('[ingestion] PostgreSQL persistence enabled');
    } catch (err) {
      console.warn(`[ingestion] PostgreSQL unavailable — running without persistence: ${err instanceof Error ? err.message : String(err)}`);
      pool = null;
    }
  } else {
    console.log('[ingestion] No DATABASE_URL set — running without persistence');
  }

  // Health check before running. Delegates to registry.healthCheckModule,
  // which treats 2xx-4xx as alive — a 404 on HEAD of a landing page means
  // the server is reachable, not that the module is unhealthy. (The old
  // inline fetch treated any non-2xx as fatal and blocked healthy modules.)
  if (module.healthCheckUrl) {
    const healthy = await healthCheckModule(module);
    if (!healthy) {
      console.warn(`[ingestion] Health check FAILED for ${module.healthCheckUrl} — skipping`);
      if (pool) {
        await persistResult(pool, {
          id: `${pipelineName}-${Date.now()}`,
          pipeline_name: pipelineName,
          category: module.category,
          source: module.sources.map(s => s.name).join(', '),
          records_count: 0,
          summary: 'Upstream health check failed',
          status: 'skipped',
          error_message: 'Upstream unreachable or unhealthy (see [HEALTH] log)',
          duration_ms: 0,
        });
      }
      await pool?.end().catch(() => {});
      process.exit(0);
    }
    console.log(`[ingestion] Health check OK: ${module.healthCheckUrl}`);
  } else {
    console.log('[ingestion] No health check URL configured — proceeding directly');
  }

  // ── Change gate (event half of the trigger) ──
  // The clock decides only how quickly we NOTICE a change, never whether we
  // do work. Probe each declared source with conditional requests; if every
  // one is unchanged, skip the pipeline and record why. probeAll() returns
  // changed:true on any probe error, so a broken source still runs and stays
  // visible -- this gate can only ever skip a run it PROVED was a no-op.
  // Opt out with QUILL_INGEST_FORCE=1 (manual/debug runs).
  const probeUrls = probeUrlsFor(moduleName);
  if (probeUrls.length > 0 && process.env.QUILL_INGEST_FORCE !== '1') {
    const { changed, results } = await probeAll(probeUrls);
    if (!changed) {
      const summary = `No change across ${probeUrls.length} source(s) since last run`;
      console.log(`[ingestion] ${summary} — skipping`);
      for (const r of results) {
        console.log(`[ingestion]   ${r.reason} (${r.statusCode}) ${r.url}`);
      }
      if (pool) {
        await persistResult(pool, {
          id: `${pipelineName}-${Date.now()}`,
          pipeline_name: pipelineName,
          category: module.category,
          source: module.sources.map(s => s.name).join(', '),
          records_count: 0,
          summary,
          status: 'skipped',
          error_message: null,
          duration_ms: 0,
        });
      }
      await pool?.end().catch(() => {});
      process.exit(0);
    }
    const changedCount = results.filter(r => r.changed).length;
    console.log(`[ingestion] Change detected (${changedCount}/${probeUrls.length} source(s) changed) — running`);
  } else if (probeUrls.length === 0) {
    console.log('[ingestion] No probe URLs for this module — running unconditionally');
  }

  // Run the module
  const startTime = Date.now();
  let recordsCount = 0;
  let summary = '';
  let errorMsg: string | null = null;
  let status: IngestionRecord['status'] = 'success';

  try {
    const result = await runModule(moduleName, { limit });
    const duration = Date.now() - startTime;
    console.log(`[ingestion] Pipeline '${moduleName}' completed in ${duration}ms`);

    if (result && typeof result === 'object') {
      const r = result as Record<string, unknown>;
      if ('skipped' in r && r.skipped) {
        status = 'skipped';
        summary = (r.reason as string) || 'Module skipped (upstream unhealthy)';
        console.log(`[ingestion] Pipeline skipped: ${summary}`);
      } else if ('error' in r && r.error) {
        status = 'failed';
        summary = String(r.error);
        console.error(`[ingestion] Pipeline returned error: ${summary}`);
      } else if ('records' in r) {
        recordsCount = Array.isArray(r.records) ? r.records.length : (typeof r.records === 'number' ? r.records as number : 0);
        summary = `Processed ${recordsCount} records`;
        console.log(`[ingestion] Records processed: ${recordsCount}`);
      } else if ('count' in r) {
        recordsCount = typeof r.count === 'number' ? r.count as number : 0;
        summary = `Processed ${recordsCount} records`;
        console.log(`[ingestion] Records processed: ${recordsCount}`);
      } else {
        summary = 'Completed (no record count available)';
      }
    } else {
      summary = 'Completed';
    }

    console.log(`[ingestion] Pipeline '${moduleName}' completed successfully`);
  } catch (err) {
    const duration = Date.now() - startTime;
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[ingestion] Pipeline '${moduleName}' FAILED after ${duration}ms: ${errMsg}`);
    status = 'failed';
    errorMsg = errMsg;
    summary = `Failed: ${errMsg}`;
  }

  const duration = Date.now() - startTime;

  // Persist result
  if (pool) {
    try {
      await persistResult(pool, {
        id: `${pipelineName}-${Date.now()}`,
        pipeline_name: pipelineName,
        category: module.category,
        source: module.sources.map(s => s.name).join(', '),
        records_count: recordsCount,
        summary,
        status,
        error_message: errorMsg,
        duration_ms: duration,
      });
      console.log('[ingestion] Result persisted to PostgreSQL');
    } catch (err) {
      console.error(`[ingestion] Failed to persist result: ${err instanceof Error ? err.message : String(err)}`);
    }
    await pool.end().catch(() => {});
  }

  process.exit(status === 'success' ? 0 : 1);
}

main();
