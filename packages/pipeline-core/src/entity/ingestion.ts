// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Entity Mention Ingestion — Quill
 *
 * Ingests entity mentions extracted from module data into
 * the entity_mentions table for cross-module queries.
 */

import { extractEntities, type EntityExtractionConfig, type ExtractionRule, type ExtractedMention } from './extractor.js';
import type { DB } from '../db/database.js';
import { restrictsPersonProfiles } from '../shared/source-policy.js';

export interface IngestionResult {
  module: string;
  recordsProcessed: number;
  mentionsInserted: number;
  errors: string[];
  durationMs: number;
}

/**
 * Ingest entity mentions from module records into the database.
 */
export async function ingestEntityMentions(
  db: DB,
  module: string,
  records: Array<Record<string, unknown>>,
): Promise<IngestionResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsProcessed = 0;
  let mentionsInserted = 0;

  for (const record of records) {
    try {
      const recordId = String(record.id ?? record.record_id ?? '');
      if (!recordId) continue;

      const config = getExtractionConfig(module, recordId, record);
      const mentions = extractEntities(config);
      // Licence policy: personal-information sources do not materialize
      // person entities (no cross-source profiles of individuals).
      const keptMentions = restrictsPersonProfiles(module)
        ? mentions.filter((mention) => mention.entityType !== 'person')
        : mentions;

      for (const mention of keptMentions) {
        await db.run(
          `INSERT INTO entity_mentions (entity_id, entity_type, entity_name, entity_normalized, module_id, record_id, record_date, confidence_score, citation_sha256, trust_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(entity_id, module_id, record_id) DO UPDATE SET
             entity_name = excluded.entity_name,
             record_date = excluded.record_date,
             confidence_score = excluded.confidence_score,
             trust_score = excluded.trust_score`,
          [
            mention.entityId,
            mention.entityType,
            mention.entityName,
            mention.entityNormalized,
            mention.moduleId,
            mention.recordId,
            mention.recordDate,
            mention.confidenceScore,
            mention.citationSha256 ?? null,
            mention.trustScore,
          ],
        );
        mentionsInserted++;
      }
      recordsProcessed++;
    } catch (error) {
      errors.push(`Record ${record.id ?? 'unknown'}: ${(error as Error).message}`);
    }
  }

  return {
    module,
    recordsProcessed,
    mentionsInserted,
    errors,
    durationMs: Date.now() - startTime,
  };
}

function getExtractionConfig(
  module: string,
  recordId: string,
  data: Record<string, unknown>,
): EntityExtractionConfig {
  const base: Pick<EntityExtractionConfig, 'module' | 'recordId' | 'data'> = { module, recordId, data };
  const rules: ExtractionRule[] = [];

  switch (module) {
    case 'committees':
      rules.push(
        { field: 'witness_name', entityType: 'person', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.9 },
        { field: 'witness_organization', entityType: 'organization', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.85 },
        { field: 'chairperson', entityType: 'person', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.95 },
      );
      break;
    case 'corporate':
      rules.push(
        { field: 'company_name', entityType: 'organization', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.95 },
        { field: 'director_name', entityType: 'person', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.85 },
        { field: 'officer_name', entityType: 'person', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.85 },
      );
      break;
    case 'lobbying':
      rules.push(
        { field: 'lobbyist_name', entityType: 'person', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.85 },
        { field: 'client_name', entityType: 'organization', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.9 },
        { field: 'organization_name', entityType: 'organization', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.85 },
      );
      break;
    case 'gic':
      rules.push(
        { field: 'appointee_name', entityType: 'person', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.9 },
        { field: 'organization', entityType: 'organization', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.85 },
        { field: 'position', entityType: 'other', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.7 },
      );
      break;
    case 'elections':
      rules.push(
        { field: 'candidate_name', entityType: 'person', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.9 },
        { field: 'party_name', entityType: 'organization', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.95 },
        { field: 'riding_name', entityType: 'location', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.85 },
      );
      break;
    default:
      // Generic: extract any field ending in _name, _organization, _person
      for (const [key, val] of Object.entries(data)) {
        if (typeof val !== 'string' || !val.trim()) continue;
        if (key.endsWith('_name') || key.includes('person')) {
          rules.push({ field: key, entityType: 'person', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.7 });
        } else if (key.endsWith('_organization') || key.includes('org')) {
          rules.push({ field: key, entityType: 'organization', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.7 });
        } else if (key.endsWith('_location') || key.includes('location')) {
          rules.push({ field: key, entityType: 'location', normalize: (v) => v.toLowerCase().trim(), confidence: () => 0.65 });
        }
      }
      break;
  }

  return { ...base, extractionRules: rules };
}

export { getExtractionConfig };
