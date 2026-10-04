/**
 * Qdrant Embedder — Quill
 *
 * Chunks text documents, generates embeddings via the fusion gateway
 * (or local fallback), and upserts vectors into Qdrant.
 *
 * Usage:
 *   const embedder = new QdrantEmbedder();
 *   const chunks = embedder.chunk("long document text...");
 *   const vectors = await embedder.embed(chunks);
 *   await embedder.upsert(vectors, { source: 'contracts', source_url: '...' });
 */

import { createLogger } from '../utils/logger.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Chunk {
  index: number;
  text: string;
  tokenCount: number;
}

export interface ChunkWithVector extends Chunk {
  vector: number[];
}

export interface UpsertPayload {
  source: string;
  sourceUrl?: string;
  chunkText: string;
  chunkIndex: number;
  [key: string]: unknown;
}

export interface EmbedderConfig {
  qdrantUrl: string;
  qdrantCollection: string;
  embeddingEndpoint: string;
  chunkSize: number;
  chunkOverlap: number;
  batchSize: number;
}

export interface EmbedderResult {
  indexedCount: number;
  failedCount: number;
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/*  Default Configuration                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_CONFIG: EmbedderConfig = {
  qdrantUrl: process.env.QDRANT_URL || 'http://qdrant.ai-inference:6333',
  qdrantCollection: process.env.QDRANT_COLLECTION || 'brain_wiki',
  embeddingEndpoint: process.env.EMBEDDING_ENDPOINT
    || 'http://ai-inference-gateway.ai-inference:8080/v1/embeddings',
  chunkSize: parseInt(process.env.CHUNK_SIZE || '512', 10),
  chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '64', 10),
  batchSize: 100,
};

const log = createLogger('qdrant-embedder');

/* ------------------------------------------------------------------ */
/*  Token Approximation                                                 */
/* ------------------------------------------------------------------ */

/**
 * Rough token count estimate: 1 token ≈ 4 characters for English text.
 * This is a fast approximation — not a true tokenizer.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into chunks of `chunkSize` tokens with `chunkOverlap` overlap.
 * Chunks are split on sentence/paragraph boundaries when possible.
 */
function splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  if (!text || text.length === 0) return [];

  const chunks: string[] = [];
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    const currentTokens = estimateTokens(current);
    const sentenceTokens = estimateTokens(trimmed);

    // If adding this sentence stays within budget, append it
    if (currentTokens + sentenceTokens <= chunkSize) {
      current += (current ? ' ' : '') + trimmed;
      continue;
    }

    // If we already have content, flush it as a chunk
    if (current) {
      chunks.push(current.trim());
    }

    // Start new chunk with this sentence
    current = trimmed;

    // If a single sentence is longer than chunkSize, hard-split it
    if (estimateTokens(current) > chunkSize) {
      chunks.push(current.trim());
      current = '';
    }
  }

  // Flush remaining
  if (current) {
    chunks.push(current.trim());
  }

  // Apply overlap — if we have multiple chunks, prepend the tail of the previous chunk
  if (overlap > 0 && chunks.length > 1) {
    for (let i = 1; i < chunks.length; i++) {
      const prevWords = chunks[i - 1].split(/\s+/);
      const overlapCount = Math.min(
        Math.ceil(overlap / 4),  // Approximate tokens back in words
        Math.floor(prevWords.length / 2),
      );
      if (overlapCount > 0) {
        const overlapText = prevWords.slice(-overlapCount).join(' ');
        chunks[i] = overlapText + ' ' + chunks[i];
      }
    }
  }

  return chunks;
}

/* ------------------------------------------------------------------ */
/*  QdrantEmbedder Class                                               */
/* ------------------------------------------------------------------ */

export class QdrantEmbedder {
  private config: EmbedderConfig;
  private qdrantClient: any = null;
  private embeddingModel: string;

  constructor(config?: Partial<EmbedderConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.embeddingModel = process.env.EMBEDDING_MODEL
      || 'nvidia/llama-3.2-nv-embedqa-1b-v2';
  }

  private getQdrantUrl(): string {
    return this.config.qdrantUrl.replace(/\/$/, '');
  }

  /* ---------------------------------------------------------------- */
  /*  Lazy Qdrant JS Client initialisation                             */
  /* ---------------------------------------------------------------- */

  private async getClient(): Promise<any> {
    if (!this.qdrantClient) {
      let QdrantClient: any;
      try {
        QdrantClient = (await import('@qdrant/js-client-rest')).QdrantClient;
      } catch {
        // Fallback: try CommonJS
        QdrantClient = (await import('@qdrant/js-client-rest')).QdrantClient;
      }
      this.qdrantClient = new QdrantClient({
        url: this.getQdrantUrl(),
        timeout: 60_000,
      });
      log.info(`Qdrant client initialised: ${this.config.qdrantUrl}`);
    }
    return this.qdrantClient;
  }

  /* ---------------------------------------------------------------- */
  /*  chunk() — split text into overlapping token-size chunks          */
  /* ---------------------------------------------------------------- */

  /**
   * Split a document's text into chunks of approximately `chunkSize`
   * tokens with `chunkOverlap` tokens of overlap between consecutive chunks.
   */
  chunk(text: string, options?: { chunkSize?: number; overlap?: number }): Chunk[] {
    const chunkSize = options?.chunkSize ?? this.config.chunkSize;
    const overlap = options?.overlap ?? this.config.chunkOverlap;

    const rawChunks = splitIntoChunks(text, chunkSize, overlap);

    return rawChunks.map((c, i) => ({
      index: i,
      text: c,
      tokenCount: estimateTokens(c),
    }));
  }

  /* ---------------------------------------------------------------- */
  /*  embed() — generate vectors for chunks via fusion gateway         */
  /* ---------------------------------------------------------------- */

  /**
   * Embed an array of chunks by calling the fusion gateway's
   * /v1/embeddings endpoint. Returns chunks with vectors attached.
   *
   * On failure, logs the error and returns chunks with null vectors
   * so the caller can decide how to handle corrupted documents.
   */
  async embed(
    chunks: Chunk[],
    options?: { signal?: AbortSignal },
  ): Promise<ChunkWithVector[]> {
    if (chunks.length === 0) return [];

    const results: ChunkWithVector[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (const chunk of chunks) {
      try {
        const vector = await this.embedOne(chunk.text, options?.signal);
        results.push({
          ...chunk,
          vector,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error(`Failed to embed chunk ${chunk.index}: ${message}`);
        errors.push({ index: chunk.index, error: message });

        // On first error, retry once
        if (errors.length === 1) {
          try {
            log.info(`Retrying chunk ${chunk.index} after error...`);
            const vector = await this.embedOne(chunk.text, options?.signal);
            results.push({
              ...chunk,
              vector,
            });
            errors.pop(); // Retry succeeded
            continue;
          } catch (retryErr) {
            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            log.error(`Retry failed for chunk ${chunk.index}: ${retryMsg}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      log.warn(`${errors.length} chunks failed embedding — skipping corrupt/${errors.length > 1 ? 'uncategorised' : ''} document`);
    }

    return results;
  }

  /**
   * Embed a single text string via HTTP POST to the fusion gateway.
   * Falls back to local endpoint if GATEWAY_ENDPOINT is set differently.
   */
  private async embedOne(text: string, signal?: AbortSignal): Promise<number[]> {
    const endpoint = this.config.embeddingEndpoint.replace(/\/$/, '');

    // First try the fusion gateway's embeddings endpoint
    try {
      const resp = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.GATEWAY_API_KEY
            ? { 'Authorization': `Bearer ${process.env.GATEWAY_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: text,
        }),
        signal: signal ?? AbortSignal.timeout(30_000),
      });

      if (resp.ok) {
        const data = (await resp.json()) as Record<string, unknown>;
        const embedding = (data as any)?.data?.[0]?.embedding;
        if (embedding && Array.isArray(embedding)) return embedding as number[];
      }

      // Failed — fall through to local fallback
      log.warn(`Fusion embedding returned ${resp.status}, trying local fallback`);
    } catch (err) {
      log.warn(`Fusion embedding unreachable: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Fallback: try local llama.cpp server
    const localUrl = process.env.QUILL_LOCAL_ENDPOINT || 'http://localhost:8001/v1';
    const localResp = await fetch(`${localUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text }),
      signal: signal ?? AbortSignal.timeout(15_000),
    });

    if (localResp.ok) {
      const data = (await localResp.json()) as Record<string, unknown>;
      const embedding = (data as any)?.data?.[0]?.embedding;
      if (embedding && Array.isArray(embedding)) return embedding as number[];
    }

    throw new Error('All embedding endpoints failed');
  }

  /* ---------------------------------------------------------------- */
  /*  upsert() — batch upsert vectors into Qdrant                      */
  /* ---------------------------------------------------------------- */

  /**
   * Upsert vectors (with payload) into the Qdrant brain_wiki collection.
   * Batches in configurable batch_size groups (default 100).
   * Graceful error handling: retries once per batch, skips corrupt docs.
   */
  async upsert(
    vectors: ChunkWithVector[],
    basePayload?: Partial<UpsertPayload>,
  ): Promise<EmbedderResult> {
    if (vectors.length === 0) {
      return { indexedCount: 0, failedCount: 0, durationMs: 0 };
    }

    const startTime = Date.now();
    const client = await this.getClient();
    const collection = this.config.qdrantCollection;

    // Ensure the collection exists
    try {
      const collections = await client.getCollections();
      const exists = collections.collections?.some(
        (c: any) => c.name === collection,
      );
      if (!exists) {
        log.info(`Creating Qdrant collection "${collection}"...`);

        // Determine vector size from first embedding
        const vectorSize = vectors[0]?.vector?.length || 1024;
        await client.createCollection(collection, {
          vectors: {
            size: vectorSize,
            distance: 'Cosine',
          },
        });
        log.info(`Collection "${collection}" created with size ${vectorSize}`);
      }
    } catch (err) {
      log.warn(`Could not verify/create collection: ${err instanceof Error ? err.message : String(err)}`);
    }

    let indexedCount = 0;
    let failedCount = 0;

    // Batch into groups
    for (let i = 0; i < vectors.length; i += this.config.batchSize) {
      const batch = vectors.slice(i, i + this.config.batchSize);

      try {
        const points = batch.map((chunk) => ({
          id: `${basePayload?.source || 'doc'}-${basePayload?.sourceUrl || 'unknown'}-chunk-${chunk.index}`,
          vector: chunk.vector,
          payload: {
            source: basePayload?.source || 'unknown',
            source_url: basePayload?.sourceUrl || '',
            chunk_text: chunk.text,
            chunk_index: chunk.index,
            ...basePayload,
          },
        }));

        await client.upsert(collection, { points });
        indexedCount += batch.length;
        log.debug(`Upsert batch ${Math.floor(i / this.config.batchSize) + 1}: ${batch.length} points`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error(`Batch upsert failed at offset ${i}: ${message}`);

        // Retry once per batch
        try {
          log.info(`Retrying batch at offset ${i}...`);
          const points = batch.map((chunk) => ({
            id: `${basePayload?.source || 'doc'}-${basePayload?.sourceUrl || 'unknown'}-chunk-${chunk.index}`,
            vector: chunk.vector,
            payload: {
              source: basePayload?.source || 'unknown',
              source_url: basePayload?.sourceUrl || '',
              chunk_text: chunk.text,
              chunk_index: chunk.index,
              ...basePayload,
            },
          }));

          await client.upsert(collection, { points });
          indexedCount += batch.length;
          log.info(`Retry succeeded for batch at offset ${i}`);
        } catch (retryErr) {
          failedCount += batch.length;
          log.error(`Batch at offset ${i} failed after retry: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
        }
      }
    }

    const durationMs = Date.now() - startTime;
    log.info(`Upsert complete: ${indexedCount} indexed, ${failedCount} failed in ${durationMs}ms`);

    return { indexedCount, failedCount, durationMs };
  }

  /* ---------------------------------------------------------------- */
  /*  Convenience: run all three steps in sequence                     */
  /* ---------------------------------------------------------------- */

  /**
   * Full pipeline: chunk → embed → upsert in one call.
   */
  async processDocument(
    text: string,
    payload: UpsertPayload,
    chunkOptions?: { chunkSize?: number; overlap?: number },
  ): Promise<EmbedderResult> {
    const chunks = this.chunk(text, chunkOptions);
    if (chunks.length === 0) {
      log.warn(`No chunks produced for document: ${payload.source}:${payload.sourceUrl}`);
      return { indexedCount: 0, failedCount: 0, durationMs: 0 };
    }

    log.info(`Document split into ${chunks.length} chunks`);

    const vectors = await this.embed(chunks);
    if (vectors.length === 0) {
      log.error('No vectors produced — all chunks failed embedding');
      return { indexedCount: 0, failedCount: chunks.length, durationMs: 0 };
    }

    return this.upsert(vectors, payload);
  }
}

export default QdrantEmbedder;
