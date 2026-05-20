// SPDX-License-Identifier: AGPL-3.0-or-later
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
export * from './graph/index.js';
export * from './brief/index.js';
export * from './pipeline.js';
export * from './legal-compliance.js';
