import type { ToolDefinition, ToolHandler } from './types.js';
import { embed } from '../ai/gateway.js';
import { searchCollection, getCollectionInfo } from '../ai/qdrant.js';

/**
 * AI Semantic Search Tool
 *
 * Semantic search over the documents currently indexed in the vector store.
 * Finds conceptually related documents even when keywords don't match.
 */

export const definition: ToolDefinition = {
  name: 'ai_search_semantic',
  description:
    'Semantic search over the documents currently indexed in the vector store, using embeddings. ' +
    'Finds conceptually related documents even when keywords do not match. ' +
    'Results are limited to what has been embedded and indexed — a module that has not been ' +
    'embedded, or indexed after your query, will not be represented. ' +
    'Uses the AI Inference Gateway for embedding and Qdrant vector DB for similarity search.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 500,
        description: 'Natural language search query (e.g., "regulatory impacts on small business", "ethics investigations into political staff")',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        description: 'Maximum number of results to return (default: 10)',
      },
      source_type: {
        type: 'string',
        description: 'Optional: filter results by source type (e.g., "committee", "lobbying", "court")',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args) => {
  const query = (args.query as string) ?? '';
  if (!query.trim()) {
    return {
      content: {
        tool: 'ai_search_semantic',
        query: '',
        error: 'No search query provided. Please include a query text for semantic search.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);
  const sourceType = (args.source_type as string) ?? '';

  try {
    // Step 1: Get collection info first to understand vector dimensions
    const collectionInfo = await getCollectionInfo();
    if (!collectionInfo) {
      return {
        content: {
          tool: 'ai_search_semantic',
          query,
          error: 'Could not access Qdrant collection "maplespike" (2048-dim Cosine). Check that Qdrant is running at nexus:30632.',
        },
        isError: true,
      };
    }

    // Step 2: Embed the query text
    const embedResult = await embed(query);
    const queryVector = embedResult.embedding;

    // Log dimension info if there's a mismatch
    if (collectionInfo.vectorSize > 0 && queryVector.length !== collectionInfo.vectorSize) {
      console.warn(
        `[ai_search_semantic] Vector dimension mismatch: embedding=${queryVector.length}, ` +
        `collection="${collectionInfo.name}" expects ${collectionInfo.vectorSize}. ` +
        `Search results may be empty or incorrect.`,
      );
    }

    // Step 3: Build optional filter for source_type
    let filter: Record<string, unknown> | undefined;
    if (sourceType) {
      filter = {
        must: [
          {
            key: 'source_type',
            match: { value: sourceType.toLowerCase() },
          },
        ],
      };
    }

    // Step 4: Search Qdrant
    const results = await searchCollection(
      queryVector,
      { limit, filter },
    );

    // Step 5: Format results
    const formattedResults = results.map((point) => ({
      id: point.id,
      score: Math.round(point.score * 1000) / 1000,
      payload: point.payload || {},
    }));

    return {
      content: {
        tool: 'ai_search_semantic',
        query,
        limit,
        sourceType: sourceType || undefined,
        collectionInfo: {
          name: collectionInfo.name,
          pointsCount: collectionInfo.pointsCount,
          vectorSize: collectionInfo.vectorSize,
          distance: collectionInfo.distance,
        },
        totalResults: results.length,
        results: formattedResults,
        embeddingModel: embedResult.model,
        note:
          results.length === 0
            ? 'No semantically similar results found. The Qdrant collection may be empty or use different vector dimensions. ' +
              'Try uploading pipeline data embeddings first, or use keyword-based search tools for immediate results.'
            : undefined,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'ai_search_semantic',
        query,
        limit,
        sourceType: sourceType || undefined,
        error: `Semantic search failed: ${(error as Error).message}`,
      },
      isError: true,
    };
  }
};
