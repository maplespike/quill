/**
 * Entity Resolution Pipeline — barrel export
 *
 * Combines entity_mentions and entity_relationships management
 * with entity extraction from module data.
 */

export { extractEntities } from './extractor.js';
export { ingestEntityMentions } from './ingestion.js';
export type { ExtractionRule, EntityExtractionConfig, ExtractedMention } from './extractor.js';
export type { IngestionResult } from './ingestion.js';
