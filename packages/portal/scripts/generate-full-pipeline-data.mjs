#!/usr/bin/env node
/**
 * Full pipeline data generator — imports pipeline-core to fetch from ALL 63 modules.
 * Run: node scripts/generate-full-pipeline-data.mjs
 * Output: packages/portal/assets/pipeline-data.json
 *
 * Unlike the standalone generator, this script uses pipeline-core's TypeScript
 * modules directly to produce data for every module.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ASSETS_DIR = resolve(__dirname, '../assets');
mkdirSync(ASSETS_DIR, { recursive: true });

// Import pipeline-core (compiled JS)
const pc = require(resolve(__dirname, '../../pipeline-core/dist/index.js'));

const startTime = Date.now();
const sources = {};
const errors = [];

// List of all ingestion modules with their ingest function and source key
const MODULES = [
  // Federal core
  { key: 'immigration', fn: () => pc.ingestAllImmigration?.({}) ?? Promise.resolve({ records: [] }) },
  { key: 'defence', fn: () => pc.ingestAllDefence?.() ?? Promise.resolve({ records: [] }) },
  { key: 'indigenous', fn: () => pc.ingestAllIndigenous?.() ?? Promise.resolve({ records: [] }) },
  { key: 'criminalJustice', fn: () => pc.ingestAllCriminalJustice?.() ?? Promise.resolve({ records: [] }) },
  { key: 'veterans', fn: () => pc.ingestAllVeterans?.() ?? Promise.resolve({ records: [] }) },
  { key: 'healthCanada', fn: () => pc.ingestHealthCanada?.() ?? Promise.resolve({ records: [] }) },
  { key: 'education', fn: () => pc.ingestAllEducationResearch?.() ?? Promise.resolve({ records: [] }) },
  { key: 'socialPrograms', fn: () => pc.ingestAllSocialPrograms?.() ?? Promise.resolve({ records: [] }) },
  { key: 'science', fn: () => pc.ingestAllScience?.() ?? Promise.resolve({ records: [] }) },
  { key: 'transport', fn: () => pc.ingestAllTransport?.() ?? Promise.resolve({ records: [] }) },

  // Corporate & influence
  { key: 'corporate', fn: () => pc.ingestAllCorporate?.() ?? Promise.resolve({ records: [] }) },
  { key: 'influence', fn: () => pc.ingestAllInfluence?.() ?? Promise.resolve({ records: [] }) },
  { key: 'lmia', fn: () => pc.ingestAllLmia?.() ?? Promise.resolve({ records: [] }) },

  // Legal & oversight
  { key: 'canlii', fn: () => pc.ingestDecisions?.() ?? Promise.resolve({ records: [] }) },
  { key: 'tribunals', fn: () => pc.ingestAllTribunals?.() ?? Promise.resolve({ records: [] }) },
  { key: 'oversight', fn: () => pc.ingestAllBodies?.() ?? Promise.resolve({ records: [] }) },
  { key: 'a2aj', fn: () => pc.ingestAllA2aj?.() ?? Promise.resolve({ records: [] }) },

  // Provincial
  { key: 'provincialLegislatures', fn: () => pc.ingestAllProvincialLegislatures?.() ?? Promise.resolve({ records: [] }) },
  { key: 'provincialLobbying', fn: () => pc.ingestAllProvincial?.() ?? Promise.resolve({ records: [] }) },
  { key: 'provincialDeep', fn: () => pc.ingestAllProvincialDeep?.() ?? Promise.resolve({ records: [] }) },

  // Deep modules
  { key: 'unions', fn: () => pc.ingestAllUnions?.() ?? Promise.resolve({ records: [] }) },
  { key: 'universities', fn: () => pc.ingestAllUniversities?.() ?? Promise.resolve({ records: [] }) },
  { key: 'corporateFilings', fn: () => pc.ingestAllFilings?.() ?? Promise.resolve({ records: [] }) },
  { key: 'federalDeep', fn: () => pc.ingestAllFederalDeep?.() ?? Promise.resolve({ records: [] }) },
  { key: 'municipalLongTail', fn: () => pc.ingestMunicipalLongTail?.() ?? Promise.resolve({ records: [] }) },

  // GoC & GC standards
  { key: 'gocSpending', fn: () => pc.ingestAllGoCSpending?.() ?? Promise.resolve({ records: [] }) },

  // Media & realtime
  { key: 'media', fn: () => pc.ingestAllMedia?.() ?? Promise.resolve({ records: [] }) },
  { key: 'realtime', fn: () => pc.ingestAllRealtime?.() ?? Promise.resolve({ records: [] }) },
  { key: 'ngoRss', fn: () => pc.ingestAllNgoRss?.() ?? Promise.resolve({ records: [] }) },
];

// Run all modules in parallel
const results = await Promise.allSettled(
  MODULES.map(async ({ key, fn }) => {
    try {
      const result = await fn();
      const data = result.records || result.data || [];
      return { key, data, recordsFound: data.length, errors: result.errors || [] };
    } catch (e) {
      return { key, data: [], recordsFound: 0, errors: [e.message] };
    }
  })
);

for (const r of results) {
  if (r.status === 'fulfilled') {
    sources[r.value.key] = {
      data: r.value.data.slice(0, 50),
      recordsFound: r.value.recordsFound,
      errors: r.value.errors,
    };
  } else {
    errors.push(r.reason?.message ?? 'unknown');
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  durationMs: Date.now() - startTime,
  moduleCount: MODULES.length,
  sources,
  stats: {
    totalRecords: Object.values(sources).reduce((s, src) => s + (src.data?.length || 0), 0),
    totalModules: MODULES.length,
    modulesWithData: Object.values(sources).filter(s => (s.data?.length || 0) > 0).length,
  },
  errors,
};

writeFileSync(resolve(ASSETS_DIR, 'pipeline-data.json'), JSON.stringify(output, null, 2));
console.log(`Generated pipeline-data.json — ${output.stats.totalModules} modules, ${output.stats.totalRecords} records, ${output.stats.modulesWithData} with data`);
