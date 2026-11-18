// SPDX-License-Identifier: AGPL-3.0-only
/**
 * AI module barrel export
 *
 * Re-exports all AI Inference Gateway and Qdrant clients
 * for convenient imports across the MCP server and pipeline-core.
 */

export {
  chatCompletion,
  embed,
  embedBatch,
  getEmbeddingDimension,
} from './gateway.js';

export type {
  GatewayConfig,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  EmbeddingResult,
} from './gateway.js';

export {
  searchCollection,
  upsertPoints,
  deletePoints,
  countPoints,
  getCollectionInfo,
  listCollections,
  searchSimilar,
} from './qdrant.js';

export type {
  QdrantConfig,
  QdrantPoint,
  QdrantScoredPoint,
  SearchOptions,
  QdrantCollectionInfo,
} from './qdrant.js';
