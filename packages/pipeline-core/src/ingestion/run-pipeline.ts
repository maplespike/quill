/**
 * MapleSpike — Ingestion Pipeline Runner
 *
 * Runs a single ingestion pipeline by module name.
 * Called by the ingestion CronJob container with MAPLESPIKE_PIPELINE env.
 *
 * Usage:
 *   node packages/pipeline-core/dist/ingestion/run-pipeline.js --name=committees
 *   node packages/pipeline-core/dist/ingestion/run-pipeline.js --name=realtime --limit=5
 *
 * Env:
 *   MAPLESPIKE_PIPELINE  — module name to run (required)
 *   NODE_ENV             — defaults to 'production'
 *   JWT_SECRET           — required for API calls (set in k8s secrets)
 */

import { runModule, getModule, REGISTRY_STATS } from './registry.js';

async function main() {
  const args = process.argv.slice(2);
  const nameFlag = args.find(a => a.startsWith('--name='));
  const limitFlag = args.find(a => a.startsWith('--limit='));
  const pipelineName = nameFlag?.split('=')[1] || process.env['MAPLESPIKE_PIPELINE'];
  const limit = limitFlag ? parseInt(limitFlag.split('=')[1], 10) : undefined;

  if (!pipelineName) {
    console.error('ERROR: No pipeline name provided. Set MAPLESPIKE_PIPELINE env or pass --name=<module>.');
    console.error(`Available modules: ${REGISTRY_STATS.totalModules} total, ${REGISTRY_STATS.activeModules} active`);
    process.exit(1);
  }

  const module = getModule(pipelineName);
  if (!module) {
    console.error(`ERROR: Module '${pipelineName}' not found in registry.`);
    process.exit(1);
  }

  if (module.status === 'placeholder') {
    console.warn(`SKIP: Module '${pipelineName}' is a placeholder — no implementation to run.`);
    process.exit(0);
  }

  console.log(`[ingestion] Starting pipeline: ${pipelineName}`);
  console.log(`[ingestion] Description: ${module.description}`);
  console.log(`[ingestion] Category: ${module.category}`);
  console.log(`[ingestion] Sources: ${module.sources.map(s => s.name).join(', ')}`);
  console.log(`[ingestion] Update frequency: ${module.updateFrequency}`);
  console.log(`[ingestion] Limit: ${limit ?? 'default'}`);

  // Health check before running
  if (module.healthCheckUrl) {
    try {
      const resp = await fetch(module.healthCheckUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      if (!resp.ok) {
        console.warn(`[ingestion] Health check FAILED for ${module.healthCheckUrl} (${resp.status}) — skipping`);
        process.exit(0);
      }
      console.log(`[ingestion] Health check OK: ${module.healthCheckUrl} → ${resp.status}`);
    } catch (err) {
      console.warn(`[ingestion] Health check error for ${module.healthCheckUrl}: ${err.message} — skipping`);
      process.exit(0);
    }
  } else {
    console.log('[ingestion] No health check URL configured — proceeding directly');
  }

  // Run the module
  const startTime = Date.now();
  try {
    const result = await runModule(pipelineName, { limit });
    const duration = Date.now() - startTime;
    console.log(`[ingestion] Pipeline '${pipelineName}' completed in ${duration}ms`);
    if (result && typeof result === 'object' && 'records' in (result as Record<string, unknown>)) {
      const records = (result as Record<string, unknown>).records;
      console.log(`[ingestion] Records processed: ${Array.isArray(records) ? records.length : 'unknown'}`);
    }
    process.exit(0);
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`[ingestion] Pipeline '${pipelineName}' FAILED after ${duration}ms: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();