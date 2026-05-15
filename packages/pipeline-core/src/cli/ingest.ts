#!/usr/bin/env node

/**
 * MapleSpike Ingestion Runner — K8s CronJob CLI entrypoint
 *
 * Reads MAPLESPIKE_PIPELINE env var and dispatches to the correct
 * module via the ingestion registry.
 *
 * Usage:
 *   MAPLESPIKE_PIPELINE=committees node dist/cli/ingest.js
 *   MAPLESPIKE_PIPELINE=all node dist/cli/ingest.js
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

import { getModule, runModule, runAllModules } from '../ingestion/registry.js';

import type { D1Database } from '../ingestion/committees/db.js';

const NULL_DB: D1Database = {
  prepare: () => { throw new Error('No database configured'); },
  exec: async () => ({ success: true }),
  batch: async () => [],
};

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
  indigenous: 'indigenous-relations',
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

async function main() {
  const pipeline = process.env.MAPLESPIKE_PIPELINE?.trim().toLowerCase() || 'help';

  if (pipeline === 'help') {
    console.log('MapleSpike Ingestion Runner');
    console.log('Usage: MAPLESPIKE_PIPELINE=<module> node dist/cli/ingest.js');
    console.log('\nAvailable modules:');
    for (const [alias, modName] of Object.entries(PIPELINE_CONFIG).sort()) {
      const mod = getModule(modName);
      if (mod) console.log(`  ${alias.padEnd(25)} ${mod.description}`);
    }
    console.log('  all                        Run all modules');
    process.exit(0);
  }

  if (pipeline === 'all') {
    console.log('[CLI] Running ALL ingestion modules...');
    const results = await runAllModules();
    let passed = 0; let failed = 0;
    for (const [name, result] of Object.entries(results)) {
      const status = (result as any)?.error ? '❌' : '✅';
      console.log(`  ${status} ${name}: ${JSON.stringify(result).substring(0, 100)}`);
      if ((result as any)?.error) failed++; else passed++;
    }
    console.log(`\n[CLI] Done: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  }

  const moduleName = PIPELINE_CONFIG[pipeline];
  if (!moduleName) {
    console.error(`[CLI] Unknown pipeline: "${pipeline}"`);
    console.error(`  Run without MAPLESPIKE_PIPELINE to see available modules`);
    process.exit(1);
  }

  const mod = getModule(moduleName);
  if (!mod) {
    console.error(`[CLI] Module "${moduleName}" not found in registry`);
    process.exit(1);
  }

  console.log(`[CLI] Running ${mod.name}: ${mod.description}`);
  try {
    const result = await runModule(moduleName, NULL_DB, {});
    console.log(`[CLI] ✅ ${mod.name} complete:`, JSON.stringify(result).substring(0, 200));
    process.exit(0);
  } catch (err) {
    console.error(`[CLI] ❌ ${mod.name} failed:`, err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[CLI] Fatal:', err);
  process.exit(1);
});
