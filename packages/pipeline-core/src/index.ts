/**
 * @maplespike/pipeline-core — MapleSpike Data Pipeline
 *
 * Canadian sovereign data pipeline core.
 * Single entry point for all extraction modules.
 */

export * from './ingestion/index.js';
export * from './curation/index.js';
export * from './verification/index.js';
export * from './audit/index.js';
