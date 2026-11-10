// SPDX-License-Identifier: AGPL-3.0-only
// packages/pipeline-core/src/entity/normalize.ts
// Entity name normalization and canonical ID generation for MapleSpike

export interface EntityMentionInput {
  rawName: string;
  sourceTable: string;
  sourceId: string;
  mentionType?: string;
  context?: any;
}

export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function generateCanonicalId(name: string, type: string = 'org'): string {
  const normalized = normalizeName(name);
  return `${type}:${normalized.replace(/\s+/g, '-')}`;
}

export function createEntityMention(input: EntityMentionInput) {
  const normalized = normalizeName(input.rawName);
  const entityId = generateCanonicalId(normalized, input.mentionType || 'other');

  return {
    entity_id: entityId,
    source_table: input.sourceTable,
    source_id: input.sourceId,
    raw_name: input.rawName,
    normalized_name: normalized,
    mention_type: input.mentionType,
    context_json: input.context ? JSON.stringify(input.context) : null,
    confidence: 1.0,
    match_method: 'exact',
    source_hash: '', // to be filled by caller
  };
}
