/**
 * Influence Ingestion — Frostbite Data Pipeline
 *
 * Orchestrates influence tracking across all sources:
 *   1. Actor catalog — register tracked influence organizations
 *   2. Funding — detect government funding flows to tracked actors
 *   3. Connections — cross-reference committees, lobbying, procurement
 *   4. Verification — track which connections are confirmed
 *
 * Designed to run alongside the corporate and committee pipelines.
 */

import { TRACKED_INFLUENCE_ACTORS } from './constants.js';
import { resolveCraBn, getActorInvestigationUrls } from './actors.js';
import { fetchGrantsCkanMetadata, matchTrackedActor, buildGrantSearchUrl } from './funding.js';
import { generateHypotheticalConnections, generateVerificationStatuses, generateActorInvestigation } from './connections.js';
import type { InfluenceIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  Actor Ingestion                                                    */
/* ------------------------------------------------------------------ */

/**
 * Register and enrich influence actors in the database.
 */
export async function ingestActors(
  options: { onProgress?: (msg: string) => void } = {},
): Promise<InfluenceIngestionResult> {
  const startTime = Date.now();
  const result: InfluenceIngestionResult = {
    actorsFound: 0,
    connectionsFound: 0,
    fundingFlowsFound: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    // Log tracked actors
    result.actorsFound = TRACKED_INFLUENCE_ACTORS.length;
    log(`[Influence] ${TRACKED_INFLUENCE_ACTORS.length} tracked actors registered`);

    // Breakdown by category
    const byCategory = new Map<string, number>();
    for (const actor of TRACKED_INFLUENCE_ACTORS) {
      byCategory.set(actor.category, (byCategory.get(actor.category) ?? 0) + 1);
    }
    for (const [cat, count] of Array.from(byCategory)) {
      log(`[Influence]   ${cat}: ${count}`);
    }

    // Generate hypothetical connections
    const connections = generateHypotheticalConnections();
    result.connectionsFound = connections.length;
    log(`[Influence] ${connections.length} hypothetical connections generated`);

    // Generate verification statuses
    const statuses = generateVerificationStatuses();
    const unverified = statuses.filter(s => s.status === 'unverified').length;
    log(`[Influence] ${unverified} actors need verification`);

    // Generate investigation URLs
    const urls = getActorInvestigationUrls();
    log(`[Influence] Investigation URLs ready for ${urls.length} actors`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[Influence] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  Funding Detection                                                  */
/* ------------------------------------------------------------------ */

/**
 * Search for government funding flows to tracked influence actors.
 */
export async function detectFundingFlows(
  options: { onProgress?: (msg: string) => void } = {},
): Promise<InfluenceIngestionResult> {
  const startTime = Date.now();
  const result: InfluenceIngestionResult = {
    actorsFound: 0,
    connectionsFound: 0,
    fundingFlowsFound: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    // Fetch CKAN grants metadata
    const ckanMeta = await fetchGrantsCkanMetadata();
    log(`[Funding] ${ckanMeta.total} grants/contributions datasets available on CKAN`);

    // Generate search URLs for each actor
    const searchUrls: { actor: string; url: string }[] = [];
    for (const actor of TRACKED_INFLUENCE_ACTORS) {
      const url = buildGrantSearchUrl(actor.name);
      searchUrls.push({ actor: actor.name, url });
    }
    result.fundingFlowsFound = searchUrls.length;
    log(`[Funding] ${searchUrls.length} grant search URLs generated`);

    // Log international organization contributions
    const { CANADA_INTL_ORG_CONTRIBUTIONS } = await import('./funding.js');
    log(`[Funding] ${CANADA_INTL_ORG_CONTRIBUTIONS.length} known IO contribution streams tracked`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[Funding] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  Full Investigation                                                 */
/* ------------------------------------------------------------------ */

/**
 * Generate a complete investigation context for a specific actor.
 */
export function investigateActor(actorName: string): ReturnType<typeof generateActorInvestigation> {
  return generateActorInvestigation(actorName);
}

/* ------------------------------------------------------------------ */
/*  Bulk Ingestion                                                     */
/* ------------------------------------------------------------------ */

/**
 * Run all influence tracking pipelines.
 */
export async function ingestAllInfluence(
  options: { onProgress?: (msg: string) => void } = {},
): Promise<{
  actors: InfluenceIngestionResult;
  funding: InfluenceIngestionResult;
}> {
  const log = options.onProgress ?? (() => {});

  log('=== Influence Tracking Ingestion ===\n');

  const [actors, funding] = await Promise.all([
    ingestActors(options),
    detectFundingFlows(options),
  ]);

  log(`\n=== Influence Summary ===`);
  log(`Actors: ${actors.actorsFound}`);
  log(`Hypothetical connections: ${actors.connectionsFound}`);
  log(`Funding search URLs: ${funding.fundingFlowsFound}`);
  
  const totalErrors = actors.errors.length + funding.errors.length;
  if (totalErrors > 0) {
    log(`Errors: ${totalErrors}`);
  }

  return { actors, funding };
}
