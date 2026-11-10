// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Entity Extractor — Quill
 *
 * Extracts entity mentions from module data records.
 * Uses fuzzy matching via the engine resolver for deduplication.
 */

import crypto from 'node:crypto';
import type { EntityMentionInput } from './normalize.js';

export interface ExtractionRule {
  /** Field name in the source record */
  field: string;
  /** Entity type for this field */
  entityType: 'person' | 'organization' | 'location' | 'other';
  /** Normalize the extracted value */
  normalize: (value: string) => string;
  /** Compute confidence score for this extraction */
  confidence: (value: string, record: Record<string, unknown>) => number;
}

export interface EntityExtractionConfig {
  module: string;
  recordId: string;
  data: Record<string, unknown>;
  extractionRules: ExtractionRule[];
}

export interface ExtractedMention {
  entityId: string;
  entityType: 'person' | 'organization' | 'location' | 'other';
  entityName: string;
  entityNormalized: string;
  moduleId: string;
  recordId: string;
  recordDate: string | null;
  confidenceScore: number;
  citationSha256: string | undefined;
  trustScore: number;
}

export function extractEntities(config: EntityExtractionConfig): ExtractedMention[] {
  const mentions: ExtractedMention[] = [];

  for (const rule of config.extractionRules) {
    const value = config.data[rule.field] as string | undefined;
    if (!value || typeof value !== 'string' || !value.trim()) continue;

    const normalized = rule.normalize(value);
    const confidence = rule.confidence(value, config.data);
    const entityId = generateEntityId(normalized, rule.entityType);

    mentions.push({
      entityId,
      entityType: rule.entityType,
      entityName: value.trim(),
      entityNormalized: normalized,
      moduleId: config.module,
      recordId: config.recordId,
      recordDate: (config.data.date as string) || (config.data.year as string) || null,
      confidenceScore: confidence,
      citationSha256: config.data.citation_sha256 as string | undefined,
      trustScore: (config.data.trust_score as number) ?? 0.6,
    });
  }

  return mentions;
}

function generateEntityId(normalized: string, type: string): string {
  return crypto.createHash('sha256').update(`${normalized}:${type}`).digest('hex').substring(0, 16);
}
