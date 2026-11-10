// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Entity Resolution Integration — Post-Ingestion Pipeline Hook
 *
 * Automatically resolves, cross-links, and extracts entities
 * after module data ingestion completes.
 *
 * This is called by the CLI ingestion runner after each module
 * completes its ingestion step.
 */

import type { DB } from '../db/database.js';
import { EntityResolutionService } from '../entity/service.js';

export interface EntityResolutionConfig {
  enabled: boolean;
  modules: string[];
  minConfidence: number;
}

const DEFAULT_CONFIG: EntityResolutionConfig = {
  enabled: true,
  modules: [
    'committees',
    'corporate',
    'lobbying',
    'gic',
    'elections',
    'provincial-lobbying',
    'federal-budget',
    'corporate-filings',
  ],
  minConfidence: 0.7,
};

export async function runEntityResolution(
  db: DB,
  moduleName: string,
  records: Array<Record<string, unknown>>,
  config: Partial<EntityResolutionConfig> = {},
): Promise<{ mentionsInserted: number; recordsProcessed: number; errors: string[] }> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  if (!fullConfig.enabled) {
    return { mentionsInserted: 0, recordsProcessed: 0, errors: [] };
  }

  if (!fullConfig.modules.includes(moduleName)) {
    return { mentionsInserted: 0, recordsProcessed: 0, errors: [] };
  }

  const service = new EntityResolutionService({ db });
  return await service.ingestModuleRecords(moduleName, records);
}

export async function buildEntityGraph(
  db: DB,
  options: { minConfidence?: number; entityTypes?: Array<'person' | 'organization' | 'location' | 'other'> } = {},
): Promise<{
  entities: Map<string, { id: string; name: string; type: string; confidence: number }>;
  relationships: Array<{ source: string; target: string; type: string; strength: number }>;
  stats: { totalMentions: number; uniqueEntities: number; modulesCovered: number };
}> {
  const service = new EntityResolutionService({ db });
  const graph = await service.buildEntityGraph(options);

  const entities = new Map(
    Array.from(graph.entities.entries()).map(([id, e]) => [
      id,
      { id, name: e.entityName, type: e.entityType, confidence: e.confidenceScore },
    ]),
  );

  const relationships = graph.relationships.map((r) => ({
    source: r.sourceEntityId,
    target: r.targetEntityId,
    type: r.relationshipType,
    strength: r.strength,
  }));

  return {
    entities,
    relationships,
    stats: {
      totalMentions: graph.totalMentions,
      uniqueEntities: graph.uniqueEntities,
      modulesCovered: graph.modulesCovered.length,
    },
  };
}

export async function getEntityStats(
  db: DB,
): Promise<{
  totalMentions: number;
  uniqueEntities: number;
  modulesCovered: number;
  topEntities: Array<{ id: string; name: string; type: string; count: number }>;
  entityTypes: Record<string, number>;
}> {
  const service = new EntityResolutionService({ db });
  return await service.getStatistics();
}