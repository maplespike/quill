#!/usr/bin/env node

/**
 * MapleSpike Ingestion Runner — K8s CronJob CLI entrypoint
 *
 * Reads CIVINT_PIPELINE env var and dispatches to the correct
 * ingestAll*() function from pipeline-core.
 *
 * Usage:
 *   CIVINT_PIPELINE=committee node dist/cli/ingest.js
 *   CIVINT_PIPELINE=corporate node dist/cli/ingest.js
 *
 * Supported pipelines:
 *   committee, corporate, influence, gazette, gic,
 *   elections, provincial-lobbying, oversight, canlii, lmia,
 *   immigration, indigenous, science, tribunals
 */

import {
  ingestAllVeterans,
  ingestAllFisheries,
  ingestAllAgriculture,
  ingestAllCulture,
  ingestAllNgoRss,
  ingestAllRegional,
  ingestAllMedia,
  ingestAllRealtime,
  ingestAllCommittees,
  ingestAllCorporate,
  ingestAllInfluence,
  ingestAllParts,
  ingestGIC,
  ingestThirdPartyAds,
  ingestAllProvincial,
  ingestAllBodies,
  ingestDecisions,
  ingestAllLmia,
  ingestAllImmigration,
  ingestAllIndigenous,
  ingestAllDefence,
  ingestAllScience,
  ingestAllTribunals,
} from '../ingestion/index.js';

import type { D1Database } from '../ingestion/committees/db.js';

const OPTIONS = {};

// Null object adapter for functions that require a non-null D1Database.
// Ingestion modules that don't receive a real DB will skip DB persistence
// and log their output to stdout (useful for pipeline-data.json generation).
const NULL_DB: D1Database = {
  prepare: () => { throw new Error('No database configured'); },
  exec: async () => ({ success: true }),
  batch: async () => [],
};

const PIPELINE_MAP: Record<string, { name: string; run: () => Promise<unknown> }> = {
  committee: {
    name: 'Committee Ingestion',
    run: () => ingestAllCommittees(NULL_DB, OPTIONS as any),
  },
  corporate: {
    name: 'Corporate Data Ingestion',
    run: () => ingestAllCorporate(null, OPTIONS as any),
  },
  influence: {
    name: 'Influence Actor Ingestion',
    run: () => ingestAllInfluence(null, OPTIONS as any),
  },
  gazette: {
    name: 'Canada Gazette Ingestion',
    run: () => ingestAllParts(null, OPTIONS as any),
  },
  gic: {
    name: 'GIC Appointment Ingestion',
    run: () => ingestGIC(null, OPTIONS as any),
  },
  elections: {
    name: 'Elections Canada Ingestion',
    run: () => ingestThirdPartyAds(null, OPTIONS as any),
  },
  'provincial-lobbying': {
    name: 'Provincial Lobbying Ingestion',
    run: () => ingestAllProvincial(null, OPTIONS as any),
  },
  oversight: {
    name: 'Oversight Body Ingestion',
    run: () => ingestAllBodies(NULL_DB, OPTIONS as any),
  },
  canlii: {
    name: 'CanLII Court Decision Ingestion',
    run: () => ingestDecisions(null, OPTIONS as any),
  },
  lmia: {
    name: 'LMIA Data Ingestion',
    run: () => ingestAllLmia(null, OPTIONS as any),
  },
  indigenous: {
    name: 'Indigenous Relations Ingestion (CIRNAC, ISC, TRC)',
    run: () => ingestAllIndigenous(null, OPTIONS as any),
  },
  defence: {
    name: 'National Defence Ingestion (DND personnel, procurement)',
    run: () => ingestAllDefence(null, OPTIONS as any),
  },
  immigration: {
    name: 'Immigration Data Ingestion (IRCC, IRB, CBSA)',
    run: () => ingestAllImmigration(OPTIONS as any),
  },

  tribunals: {
    name: 'Federal Tribunal Data Ingestion (SST, CITT, CHRT, Copyright Board, etc.)',
    run: () => ingestAllTribunals(),
  },
  veterans: { name: "Veterans Affairs Data Ingestion", run: () => ingestAllVeterans(), },
  fisheries: { name: "Fisheries & Oceans Data Ingestion", run: () => ingestAllFisheries(), },
  agriculture: { name: "Agriculture & Agri-Food Data Ingestion", run: () => ingestAllAgriculture(), },
  culture: { name: "Culture & Heritage Data Ingestion", run: () => ingestAllCulture(), },
  'ngo-rss': { name: "NGO / Influence RSS Narrative Tracking", run: () => ingestAllNgoRss(), },
  'regional-authorities': { name: "Regional Authorities Data (Peel, York, Durham, Metro Vancouver, CRD, etc.)", run: () => ingestAllRegional(), },
  'media': { name: "Media & Broadcasting Data (CRTC market reports, ownership charts, Canada Media Fund, Telefilm)", run: () => ingestAllMedia(), },
  'realtime': { name: "Real-Time Feeds (ECCC weather alerts, CBSA border wait times, parole board decisions)", run: () => ingestAllRealtime(), },
};

async function main(): Promise<void> {
  const pipeline = process.env.CIVINT_PIPELINE || '';

  if (!pipeline || !PIPELINE_MAP[pipeline]) {
    console.error(`[maplespike-ingest] Unknown or missing CIVINT_PIPELINE. Supported: ${Object.keys(PIPELINE_MAP).join(', ')}`);
    process.exit(1);
  }

  const entry = PIPELINE_MAP[pipeline];
  console.log(`[maplespike-ingest] Starting ${entry.name}...`);

  const startTime = Date.now();
  try {
    const result = await entry.run();
    const elapsed = Date.now() - startTime;
    console.log(`[maplespike-ingest] ${entry.name} complete in ${elapsed}ms`);
    if (result && typeof result === 'object') {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exit(0);
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error(`[maplespike-ingest] ${entry.name} FAILED after ${elapsed}ms:`, err);
    process.exit(1);
  }
}

main();
