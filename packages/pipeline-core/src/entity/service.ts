// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Entity Resolution Service — High-level entity operations
 *
 * Combines extraction, ingestion, and querying into a unified service.
 * Provides entity resolution, relationship discovery, and graph building.
 */

import type { DB } from '../db/database.js';
import { extractEntities, type EntityExtractionConfig, type ExtractionRule, type ExtractedMention } from './extractor.js';
import { getExtractionConfig } from './ingestion.js';
import { normalizeName } from './normalize.js';
import { computeHash } from '../verification/hashing.js';

export interface EntityMatch {
  entityId: string;
  entityName: string;
  /** French name for the entity (if available) */
  entityNameFr?: string;
  entityType: 'person' | 'organization' | 'location' | 'other';
  entityNormalized: string;
  confidenceScore: number;
  moduleId: string;
  recordId: string;
  recordDate: string | null;
}

export interface EntityRelationship {
  sourceEntityId: string;
  sourceEntityName: string;
  targetEntityId: string;
  targetEntityName: string;
  relationshipType: string;
  strength: number;
  sourceModule: string;
  targetModule: string;
}

export interface EntityGraph {
  entities: Map<string, EntityMatch>;
  relationships: EntityRelationship[];
  totalMentions: number;
  uniqueEntities: number;
  modulesCovered: string[];
}

export interface ResolutionOptions {
  minConfidence?: number;
  entityTypes?: Array<'person' | 'organization' | 'location' | 'other'>;
  includePrivate?: boolean;
}

export interface ServiceConfig {
  db: DB;
}

export class EntityResolutionService {
  private db: DB;
  private config: ServiceConfig;

  constructor(config: ServiceConfig) {
    this.db = config.db;
    this.config = config;
  }

  async resolveEntity(name: string, options: ResolutionOptions = {}): Promise<EntityMatch[]> {
    const normalized = normalizeName(name);
    const minConfidence = options.minConfidence ?? 0.7;

    const stmt = this.db.prepare(`
      SELECT DISTINCT entity_id, entity_name, entity_type, entity_normalized,
             module_id, confidence_score, record_date
      FROM entity_mentions
      WHERE entity_normalized LIKE ?
        ${options.entityTypes ? `AND entity_type IN (${options.entityTypes.map(() => '?').join(',')})` : ''}
        ${options.includePrivate ? '' : `AND trust_score >= 0.5`}
        AND confidence_score >= ?
      ORDER BY confidence_score DESC, record_date DESC
      LIMIT 50
    `);

    const params: any[] = [
      `${normalized}%`,
      ...(options.entityTypes || []),
      minConfidence,
    ];

    const rows = await stmt.all(...params);
    return rows.map((r: any) => ({
      entityId: r.entity_id,
      entityName: r.entity_name,
      entityType: r.entity_type,
      entityNormalized: r.entity_normalized,
      confidenceScore: r.confidence_score,
      moduleId: r.module_id,
      recordId: r.record_id,
      recordDate: r.record_date,
    }));
  }

  async getRelatedEntities(entityId: string): Promise<Map<string, EntityMatch[]>> {
    const stmt = this.db.prepare(`
      SELECT m.module_id, m.entity_id, m.entity_name, m.entity_type,
             m.entity_normalized, m.confidence_score, m.record_id, m.record_date
      FROM entity_mentions m
      WHERE entity_id = ? OR entity_normalized IN (
        SELECT entity_normalized
        FROM entity_mentions
        WHERE entity_id = ?
      )
      ORDER BY m.confidence_score DESC
    `);

    const rows = await stmt.all(entityId, entityId);
    const byModule = new Map<string, EntityMatch[]>();

    for (const row of rows as any[]) {
      const mod = row.module_id;
      if (!byModule.has(mod)) byModule.set(mod, []);
      byModule.get(mod)!.push({
        entityId: row.entity_id,
        entityName: row.entity_name,
        entityType: row.entity_type,
        entityNormalized: row.entity_normalized,
        confidenceScore: row.confidence_score,
        moduleId: mod,
        recordId: row.record_id,
        recordDate: row.record_date,
      });
    }

    return byModule;
  }

  async buildEntityGraph(options: ResolutionOptions = {}): Promise<EntityGraph> {
    const minConfidence = options.minConfidence ?? 0.7;
    const modules: string[] = [];

    const entityStmt = this.db.prepare(`
      SELECT DISTINCT entity_id, entity_name, entity_type, entity_normalized,
             confidence_score, module_id, record_date, SUM(CASE WHEN trust_score >= 0.5 THEN 1 ELSE 0 END) as mentions
      FROM entity_mentions
      WHERE confidence_score >= ?
        ${options.includePrivate ? '' : `AND trust_score >= 0.5`}
        ${options.entityTypes ? `AND entity_type IN (${options.entityTypes.map(() => '?').join(',')})` : ''}
      GROUP BY entity_id, entity_name, entity_type, entity_normalized, confidence_score, module_id, record_date
      HAVING mentions >= 2
      ORDER BY mentions DESC, confidence_score DESC
      LIMIT 100
    `);

    const entityRows = await entityStmt.all(...(options.entityTypes || []), minConfidence, minConfidence);

    const modulesSet = new Set<string>();
    for (const row of entityRows as any[]) {
      modulesSet.add(row.module_id);
    }
    modules.push(...modulesSet);

    const entities = new Map<string, EntityMatch>();
    for (const row of entityRows as any[]) {
      entities.set(row.entity_id, {
        entityId: row.entity_id,
        entityName: row.entity_name,
        entityType: row.entity_type,
        entityNormalized: row.entity_normalized,
        confidenceScore: row.confidence_score,
        moduleId: row.module_id,
        recordId: '',
        recordDate: row.record_date,
      });
    }

    const relStmt = this.db.prepare(`
      SELECT m1.entity_id as source_id, m1.entity_name as source_name, m1.entity_type as source_type,
             m2.entity_id as target_id, m2.entity_name as target_name, m2.entity_type as target_type,
             m1.module_id as source_module, m2.module_id as target_module, COUNT(*) as strength
      FROM entity_mentions m1
      INNER JOIN entity_mentions m2
        ON m1.record_id = m2.record_id
        AND m1.entity_id != m2.entity_id
        AND m1.confidence_score >= ? AND m2.confidence_score >= ?
      GROUP BY source_id, target_id
      HAVING strength >= 2
      ORDER BY strength DESC
      LIMIT 200
    `);

    const relationRows = await relStmt.all(minConfidence, minConfidence);
    const relationships: EntityRelationship[] = relationRows.map((r: any) => ({
      sourceEntityId: r.source_id,
      sourceEntityName: r.source_name,
      targetEntityId: r.target_id,
      targetEntityName: r.target_name,
      relationshipType: this.deriveRelationshipType(r.source_type, r.target_type),
      strength: r.strength,
      sourceModule: r.source_module,
      targetModule: r.target_module,
    }));

    const totalCount = await this.db.prepare('SELECT COUNT(*) as count FROM entity_mentions').get();

    return {
      entities,
      relationships,
      totalMentions: (totalCount as any)?.count ?? 0,
      uniqueEntities: entities.size,
      modulesCovered: modules,
    };
  }

  async ingestModuleRecords(
    module: string,
    records: Array<Record<string, unknown>>,
  ): Promise<{ mentionsInserted: number; recordsProcessed: number; errors: string[] }> {
    const errors: string[] = [];
    let recordsProcessed = 0;
    let mentionsInserted = 0;

    for (const record of records) {
      const recordId = String(record.id ?? record.record_id ?? '');
      if (!recordId) {
        continue;
      }

      const config = getExtractionConfig(module, recordId, record);
      const mentions = extractEntities(config);

      for (const mention of mentions) {
        const recordDate = mention.recordDate || String(record.date || record.record_date || '');

        try {
          await this.db.run(
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
              module,
              computeHash(recordDate + mention.entityId),
              recordDate,
              mention.confidenceScore,
              mention.citationSha256,
              mention.trustScore,
            ],
          );
          mentionsInserted++;
        } catch (error) {
          errors.push(`Record ${recordId}: ${(error as Error).message}`);
        }
      }

      recordsProcessed++;
    }

    return { mentionsInserted, recordsProcessed, errors };
  }

  async getStatistics(): Promise<{
    totalMentions: number;
    uniqueEntities: number;
    modulesCovered: number;
    topEntities: Array<{ id: string; name: string; type: string; count: number }>;
    entityTypes: Record<string, number>;
  }> {
    const total = await this.db.prepare('SELECT COUNT(*) as count FROM entity_mentions').get();

    const unique = await this.db.prepare('SELECT COUNT(DISTINCT entity_id) as count FROM entity_mentions').get();

    const modules = await this.db.prepare('SELECT COUNT(DISTINCT module_id) as count FROM entity_mentions').get();

    const topStmt = this.db.prepare(`
      SELECT entity_id, entity_name, entity_type, COUNT(*) as count
      FROM entity_mentions
      WHERE trust_score >= 0.5
      GROUP BY entity_id, entity_name, entity_type
      ORDER BY count DESC
      LIMIT 10
    `);
    const top = await topStmt.all();

    const typesStmt = this.db.prepare(`
      SELECT entity_type, COUNT(DISTINCT entity_id) as count
      FROM entity_mentions
      WHERE trust_score >= 0.5
      GROUP BY entity_type
    `);
    const types = await typesStmt.all();

    return {
      totalMentions: (total as any)?.count ?? 0,
      uniqueEntities: (unique as any)?.count ?? 0,
      modulesCovered: (modules as any)?.count ?? 0,
      topEntities: top.map((r: any) => ({
        id: r.entity_id,
        name: r.entity_name,
        type: r.entity_type,
        count: r.count,
      })),
      entityTypes: Object.fromEntries(types.map((r: any) => [r.entity_type, r.count])),
    };
  }

  private deriveRelationshipType(sourceType: string, targetType: string): string {
    const pairs: Record<string, string> = {
      'person-organization': 'affiliation',
      'organization-person': 'employs',
      'person-location': 'based-in',
      'location-person': 'location-of',
      'organization-organization': 'collaborates',
      'person-person': 'co-mentioned',
      'location-location': 'adjacent',
      'organization-location': 'located-in',
      'location-organization': 'headquartered',
      'person-other': 'references',
      'organization-other': 'related-to',
      'location-other': 'near',
      'other-*': 'linked-to',
      '*-*': 'co-occurs-with',
    };

    const key = `${sourceType}-${targetType}`;
    return pairs[key] || pairs['*-*'];
  }
}