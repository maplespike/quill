/**
 * Influence Connections — MapleSpike Pipeline
 *
 * Cross-references tracked influence actors against:
 *   - Parliamentary committee appearances (already ingested)
 *   - Lobbying registry (already ingested)
 *   - Procurement contracts (already ingested)
 *   - Corporate board interlocks
 *
 * This is the integration layer that connects actors → government
 * through verifiable public-source evidence.
 */

import { TRACKED_INFLUENCE_ACTORS, findInfluenceActor } from './constants.js';
import { matchTrackedActor } from './funding.js';
import type { InfluenceConnection, ConnectionType, InfluenceIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  Cross-Reference Engine                                             */
/* ------------------------------------------------------------------ */

/**
 * Generate potential influence connections based on known data
 * about each tracked actor. These are hypotheses to be verified
 * against actual data from committees, lobbying, and procurement.
 */
export function generateHypotheticalConnections(): InfluenceConnection[] {
  const connections: InfluenceConnection[] = [];

  for (const actor of TRACKED_INFLUENCE_ACTORS) {
    const now = new Date().toISOString();

    // International orgs: known membership-based connections
    if (actor.category === 'international-organization') {
      connections.push({
        id: `membership-${actor.id}`,
        actorId: actor.id,
        actorName: actor.name,
        governmentEntity: 'Government of Canada',
        connectionType: 'international-agreement',
        description: `Canada is a member/signatory of ${actor.name}`,
        date: actor.founded ? `${actor.founded}-01-01` : '1900-01-01',
        valueCad: null,
        sourceUrl: `https://www.international.gc.ca/world-monde/international_relations-relations_internationales/`,
        sourceSystem: 'constitution',
        sourceRecordId: null,
        ingestedAt: now,
      });
    }

    // Think tanks and consultancies: likely committee appearances
    if (actor.category === 'think-tank' || actor.category === 'consultancy') {
      connections.push({
        id: `testimony-${actor.id}`,
        actorId: actor.id,
        actorName: actor.name,
        governmentEntity: 'Parliament of Canada',
        connectionType: 'committee-testimony',
        description: `Likely testimony by ${actor.name} before parliamentary committee`,
        date: '',
        valueCad: null,
        sourceUrl: `https://www.ourcommons.ca/search?sr=${encodeURIComponent(actor.name)}&cat=publications&type=evidence`,
        sourceSystem: 'committee-evidence',
        sourceRecordId: null,
        ingestedAt: now,
      });
    }

    // Charities: likely government funding
    if (actor.isCraCharity) {
      connections.push({
        id: `funding-${actor.id}`,
        actorId: actor.id,
        actorName: actor.name,
        governmentEntity: 'Government of Canada',
        connectionType: 'funding-received',
        description: `${actor.name} may receive federal grants/contributions as a registered charity`,
        date: '',
        valueCad: null,
        sourceUrl: `https://search.open.canada.ca/api/select?q=${encodeURIComponent(`"${actor.name}"`)}+grants&rows=5&wt=json`,
        sourceSystem: 'grants',
        sourceRecordId: null,
        ingestedAt: now,
      });
    }
  }

  return connections;
}

/* ------------------------------------------------------------------ */
/*  Connection Verification Status                                     */
/* ------------------------------------------------------------------ */

export interface ConnectionVerification {
  actorId: string;
  actorName: string;
  category: string;
  priority: string;
  /** Verified connections found in actual data */
  verifiedConnections: number;
  /** Hypothetical connections needing verification */
  pendingConnections: number;
  /** Data sources checked */
  sourcesChecked: string[];
  /** Verification status */
  status: 'verified' | 'partial' | 'unverified' | 'not-applicable';
}

/**
 * Generate verification status for all tracked actors.
 */
export function generateVerificationStatuses(): ConnectionVerification[] {
  return TRACKED_INFLUENCE_ACTORS.map(actor => {
    const applicableSources: string[] = [];

    if (actor.isCraCharity) applicableSources.push('cra-charities');
    if (actor.category !== 'international-organization') applicableSources.push('lobbying');
    if (actor.category === 'think-tank' || actor.category === 'consultancy' || actor.category === 'professional-body') {
      applicableSources.push('committee-evidence');
    }
    if (actor.category === 'consultancy') applicableSources.push('procurement');

    return {
      actorId: actor.id,
      actorName: actor.name,
      category: actor.category,
      priority: actor.priority,
      verifiedConnections: 0,
      pendingConnections: hypotheticalCountForActor(actor),
      sourcesChecked: applicableSources,
      status: 'unverified',
    };
  });
}

function hypotheticalCountForActor(actor: typeof TRACKED_INFLUENCE_ACTORS[number]): number {
  let count = 0;
  if (actor.category === 'international-organization') count++;
  if (actor.category === 'think-tank' || actor.category === 'consultancy') count++;
  if (actor.isCraCharity) count++;
  return count;
}

/* ------------------------------------------------------------------ */
/*  Influence Investigation Checklist                                  */
/* ------------------------------------------------------------------ */

/**
 * Generate a complete investigation checklist for an influence actor.
 * This is what a journalist or researcher would need to verify.
 */
export function generateActorInvestigation(
  actorName: string,
): {
  found: boolean;
  actor?: typeof TRACKED_INFLUENCE_ACTORS[number];
  checklist: string[];
} | null {
  const actor = findInfluenceActor(actorName);
  if (!actor) return null;

  const checklist: string[] = [];

  // 1. CRA check
  if (actor.isCraCharity) {
    checklist.push(`🔍 Search CRA charity registry: https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch?q=${encodeURIComponent(actor.name)}`);
    checklist.push(`📊 Review financial statements (T3010) for revenue sources and directors`);
  }

  // 2. Committee appearances
  checklist.push(`🏛 Check House committee appearances: https://www.ourcommons.ca/search?sr=${encodeURIComponent(actor.name)}&cat=publications&type=evidence`);
  checklist.push(`🏛 Check Senate committee appearances: https://sencanada.ca/en/search/?q=${encodeURIComponent(actor.name)}`);

  // 3. Lobbying
  checklist.push(`📋 Search lobbying registry: https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/registrationsearch.shtml?search=${encodeURIComponent(actor.name)}`);

  // 4. Government funding
  checklist.push(`💰 Search grants & contributions: https://search.open.canada.ca/api/select?q=${encodeURIComponent(`"${actor.name}"`)}+grants&rows=10&wt=json`);

  // 5. Procurement
  checklist.push(`🛒 Check procurement contracts: https://search.open.canada.ca/api/select?q=${encodeURIComponent(`"${actor.name}"`)}+contract&rows=10&wt=json`);

  // 6. Board interlocks
  checklist.push(`🔗 Search for board members in corporate registry: https://ised-isde.canada.ca/cc/lc/gcrecherche-recherche.html?q=${encodeURIComponent(actor.name)}`);

  // 7. News
  checklist.push(`📰 News search: https://www.google.com/search?q=${encodeURIComponent(`${actor.name} Canada government policy`)}`);

  return { found: true, actor, checklist };
}
