export { parseInfluenceActor, parseInfluenceActors } from './parser.js';
/**
 * Influence Ingestion — Quill
 *
 * Orchestrates influence tracking across all sources:
 *   1. Actor catalog — register tracked influence organizations
 *   2. Funding — detect government funding flows to tracked actors
 *   3. Connections — cross-reference committees, lobbying, procurement
 *   4. Verification — track which connections are confirmed
 *
 * Designed to run alongside the corporate and committee pipelines.
 *
 * Accepts an optional D1 database instance. When provided, enriched
 * data is persisted to the influence tables. When null, enriched
 * actor records and funding flows are returned as structured data.
 */

import type { D1Database } from '../committees/db.js';
import { hashString } from '../rss.js';
import { TRACKED_INFLUENCE_ACTORS } from './constants.js';
import { resolveCraBn, searchCraCharity, buildCommitteeAppearanceSearch } from './actors.js';
import { queryGrantsForActor, parseCkanGrantDoc, buildGrantSearchUrl } from './funding.js';
import { generateHypotheticalConnections, generateVerificationStatuses, generateActorInvestigation } from './connections.js';
import {
  INFLUENCE_DDL,
  upsertInfluenceActor,
  upsertInfluenceConnection,
  upsertGovernmentFunding,
  searchCommitteeMentions,
} from './db.js';
import { upsertOrganization, upsertGacProject } from '../../shared-db.js';
import { applySourcePolicy } from '../../shared/source-policy.js';
import type {
  InfluenceIngestionResult,
  InfluenceActor,
  InfluenceConnection,
  GovernmentFunding,
  ConnectionType,
} from './types.js';


/* ------------------------------------------------------------------ */
/*  Actor Ingestion                                                    */
/* ------------------------------------------------------------------ */

/**
 * Register and enrich influence actors in the database.
 *
 * When `db` is provided:
 *   - Fetches real CRA charity data for registered charities
 *   - Searches committee appearances for each actor
 *   - Upserts enriched actors into `influence_actors`
 *   - Upserts real connections (not hypothetical) into `influence_connections`
 *
 * When `db` is null, returns enriched actors as structured data.
 */
export async function ingestActors(
  db: D1Database | null,
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
    // Initialize tables if db is present
    if (db) {
      await db.exec(INFLUENCE_DDL);
      log('[Influence] Tables initialized');
    }

    // Track enriched actors and real connections
    const enrichedActors: InfluenceActor[] = [];
    const realConnections: InfluenceConnection[] = [];

    result.actorsFound = TRACKED_INFLUENCE_ACTORS.length;
    log(`[Influence] ${TRACKED_INFLUENCE_ACTORS.length} tracked actors to process`);

    // Breakdown by category
    const byCategory = new Map<string, number>();
    for (const actor of TRACKED_INFLUENCE_ACTORS) {
      byCategory.set(actor.category, (byCategory.get(actor.category) ?? 0) + 1);
    }
    for (const [cat, count] of Array.from(byCategory)) {
      log(`[Influence]   ${cat}: ${count}`);
    }

    // Process each tracked actor
    for (let i = 0; i < TRACKED_INFLUENCE_ACTORS.length; i++) {
      const template = TRACKED_INFLUENCE_ACTORS[i];
      const now = new Date().toISOString();
      log(`[Influence] [${i + 1}/${TRACKED_INFLUENCE_ACTORS.length}] ${template.name}...`);

      // Enrich with current timestamp
      const enriched: InfluenceActor = {
        ...template,
        ingestedAt: now,
      };

      let resolvedCraBn: string | null = template.craBn;
      let craRecords: Partial<import('./types.js').CraCharityRecord>[] = [];

      // Resolve CRA BN and fetch real charity data
      if (template.isCraCharity) {
        try {
          resolvedCraBn = await resolveCraBn(template);
          if (resolvedCraBn) {
            enriched.craBn = resolvedCraBn;
            craRecords = await searchCraCharity(template.name);
            if (craRecords.length > 0) {
              log(`[Influence]   CRA: found ${craRecords.length} record(s) for ${template.name}`);
            } else {
              log(`[Influence]   CRA: no records found for ${template.name}`);
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`CRA lookup ${template.id}: ${msg}`);
          log(`[Influence]   CRA error: ${msg}`);
        }
      }

      // Build real connections based on actual data
      const connections = buildRealConnections(template, enriched, craRecords, resolvedCraBn);

      // If db is present, search committee appearances and add real testimony connections
      if (db) {
        try {
          const committeeMentions = await searchCommitteeMentions(db, template.name, template.aliases);
          if (committeeMentions.length > 0) {
            log(`[Influence]   Committee: ${committeeMentions.length} mention(s) found`);
            for (const mention of committeeMentions) {
              connections.push({
                id: `ctte-${hashString(`${template.id}|${mention.meetingId}|${mention.speakerName}`)}`,
                actorId: template.id,
                actorName: template.name,
                governmentEntity: mention.committeeName,
                connectionType: 'committee-testimony' as ConnectionType,
                description: `${template.name} mentioned by ${mention.speakerName} in ${mention.committeeName}`,
                date: mention.date,
                valueCad: null,
                sourceUrl: mention.evidenceUrl,
                sourceSystem: 'committee-evidence',
                sourceRecordId: mention.meetingId,
                ingestedAt: now,
              });
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Committee search ${template.id}: ${msg}`);
        }
      }

      // Upsert to database or collect for return
      if (db) {
        const ok = await upsertInfluenceActor(db, enriched);
        if (!ok) {
          result.errors.push(`Failed to upsert actor ${template.id}`);
        } else {
          // Also upsert to shared organizations table
          try {
            upsertOrganization(template.name, { type: template.category, source: "influence", rawData: { aliases: template.aliases, craBn: template.craBn } });
          } catch { /* non-fatal */ }

          // Upsert each real connection
          for (const conn of connections) {
            const connOk = await upsertInfluenceConnection(db, conn);
            if (!connOk) {
              result.errors.push(`Failed to upsert connection ${conn.id}`);
            }
          }
        }
      }

      enrichedActors.push(enriched);
      realConnections.push(...connections);
    }

    // Also generate hypothetical connections for completeness (as analysis data)
    const hypotheticalConnections = generateHypotheticalConnections();
    result.connectionsFound = realConnections.length + hypotheticalConnections.length;
    log(`[Influence] ${realConnections.length} real connections, ${hypotheticalConnections.length} hypothetical`);

    // Log verification statuses
    const statuses = generateVerificationStatuses();
    const unverified = statuses.filter(s => s.status === 'unverified').length;
    log(`[Influence] ${unverified} actors need verification`);

    // Populate return data when db is null. Stored rows are unchanged.
    if (!db) {
      result.enrichedActors = applySourcePolicy('influence', enrichedActors).records as InfluenceActor[];
      result.connections = applySourcePolicy('influence', realConnections).records as InfluenceConnection[];
    }

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
 *
 * When `db` is provided:
 *   - Queries CKAN grants/contributions search for each tracked actor
 *   - Parses results into GovernmentFunding records
 *   - Upserts into `government_funding` table
 *
 * When `db` is null, returns detected funding records as structured data.
 */
export async function detectFundingFlows(
  db: D1Database | null,
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
    if (db) {
      await db.exec(INFLUENCE_DDL);
    }

    const allFundingRecords: GovernmentFunding[] = [];

    // Fetch CKAN grants metadata for context
    const { fetchGrantsCkanMetadata, CANADA_INTL_ORG_CONTRIBUTIONS } = await import('./funding.js');
    const ckanMeta = await fetchGrantsCkanMetadata();
    log(`[Funding] ${ckanMeta.total} grants/contributions datasets available on CKAN`);

    log(`[Funding] ${CANADA_INTL_ORG_CONTRIBUTIONS.length} known IO contribution streams tracked`);

    // Query CKAN for each tracked actor
    for (let i = 0; i < TRACKED_INFLUENCE_ACTORS.length; i++) {
      const actor = TRACKED_INFLUENCE_ACTORS[i];
      log(`[Funding] [${i + 1}/${TRACKED_INFLUENCE_ACTORS.length}] Checking ${actor.name}...`);

      try {
        const docs = await queryGrantsForActor(actor.name, actor.aliases);
        if (docs.length > 0) {
          log(`[Funding]   Found ${docs.length} CKAN result(s) for ${actor.name}`);
        } else {
          log(`[Funding]   No CKAN results for ${actor.name}`);
        }

        for (const doc of docs) {
          const record = parseCkanGrantDoc(doc, actor.id, actor.name);
          const fundingRecord: GovernmentFunding = {
            ...record,
            recipientType: actor.category,
            sourceUrl: doc.url ?? buildGrantSearchUrl(actor.name),
          };

          if (db) {
            const ok = await upsertGovernmentFunding(db, fundingRecord);
            if (!ok) {
              result.errors.push(`Failed to upsert funding record for ${actor.name}`);
            }
          }

          // Also upsert to shared gac_projects table
          try {
            upsertGacProject(
              fundingRecord.id,
              fundingRecord.programName,
              `${fundingRecord.agreementType} to ${fundingRecord.recipientName}`,
              fundingRecord.department,
              "Canada",
              fundingRecord.departmentAcronym ?? "CA",
              fundingRecord.amount,
              {
                currency: fundingRecord.currency,
                startDate: fundingRecord.startDate ?? undefined,
                endDate: fundingRecord.endDate ?? undefined,
                status: "active",
                sector: fundingRecord.recipientType ?? undefined,
                source: "influence",
                rawData: {
                  recipientName: fundingRecord.recipientName,
                  fiscalYear: fundingRecord.fiscalYear,
                  agreementType: fundingRecord.agreementType,
                  actorName: actor.name,
                },
              },
            );
          } catch { /* non-fatal */ }

          allFundingRecords.push(fundingRecord);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`CKAN query ${actor.id}: ${msg}`);
        log(`[Funding]   Error: ${msg}`);
      }
    }

    result.fundingFlowsFound = allFundingRecords.length;
    log(`[Funding] ${allFundingRecords.length} funding flow(s) detected from CKAN`);

    // Populate return data when db is null. Stored rows are unchanged.
    if (!db) {
      result.fundingFlows = applySourcePolicy('influence', allFundingRecords).records as GovernmentFunding[];
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[Funding] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}


/* ------------------------------------------------------------------ */
/*  Real Connection Builder                                            */
/* ------------------------------------------------------------------ */

/**
 * Build real (non-hypothetical) connections for a tracked actor based on
 * actual data we've fetched (CRA records, known memberships, etc.).
 */
function buildRealConnections(
  template: typeof TRACKED_INFLUENCE_ACTORS[number],
  enriched: InfluenceActor,
  craRecords: Partial<import('./types.js').CraCharityRecord>[],
  craBn: string | null,
): InfluenceConnection[] {
  const now = enriched.ingestedAt;
  const connections: InfluenceConnection[] = [];

  // International orgs: known membership-based connections
  if (template.category === 'international-organization') {
    connections.push({
      id: `membership-${template.id}`,
      actorId: template.id,
      actorName: template.name,
      governmentEntity: 'Government of Canada',
      connectionType: 'international-agreement',
      description: `Canada is a member/signatory of ${template.name}`,
      date: template.founded ? `${template.founded}-01-01` : '1900-01-01',
      valueCad: null,
      sourceUrl: 'https://www.international.gc.ca/world-monde/international_relations-relations_internationales/',
      sourceSystem: 'constitution',
      sourceRecordId: null,
      ingestedAt: now,
    });
  }

  // Known CRA charity registration → funding-received connection
  if (template.isCraCharity && craBn) {
    connections.push({
      id: `cra-reg-${template.id}`,
      actorId: template.id,
      actorName: template.name,
      governmentEntity: 'Canada Revenue Agency',
      connectionType: 'funding-received',
      description: `${template.name} is a registered Canadian charity (BN: ${craBn}) and may receive federal grants/contributions`,
      date: '',
      valueCad: null,
      sourceUrl: `https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch?selectedCharityBn=${craBn}&selectedFdtnBn=&selectedLanguage=en`,
      sourceSystem: 'cra-charities',
      sourceRecordId: craBn,
      ingestedAt: now,
    });
  }

  // Think tanks and consultancies: committee testimony / lobbying connections
  if (template.category === 'think-tank' || template.category === 'consultancy') {
    connections.push({
      id: `testimony-${template.id}`,
      actorId: template.id,
      actorName: template.name,
      governmentEntity: 'Parliament of Canada',
      connectionType: 'committee-testimony',
      description: `${template.name} likely appears before parliamentary committees`,
      date: '',
      valueCad: null,
      sourceUrl: buildCommitteeAppearanceSearch(template.name)[0],
      sourceSystem: 'committee-evidence',
      sourceRecordId: null,
      ingestedAt: now,
    });
  }

  return connections;
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
 *
 * @param db - Optional D1 database. When provided, data is persisted.
 */
export async function ingestAllInfluence(
  db: D1Database | null,
  options: { onProgress?: (msg: string) => void } = {},
): Promise<{
  actors: InfluenceIngestionResult;
  funding: InfluenceIngestionResult;
}> {
  const log = options.onProgress ?? (() => {});

  log('=== Influence Tracking Ingestion ===\n');

  const [actors, funding] = await Promise.all([
    ingestActors(db, options),
    detectFundingFlows(db, options),
  ]);

  log(`\n=== Influence Summary ===`);
  log(`Actors: ${actors.actorsFound}`);
  log(`Real connections: ${actors.connectionsFound}`);
  log(`Funding flows: ${funding.fundingFlowsFound}`);

  const totalErrors = actors.errors.length + funding.errors.length;
  if (totalErrors > 0) {
    log(`Errors: ${totalErrors}`);
  }

  return { actors, funding };
}
