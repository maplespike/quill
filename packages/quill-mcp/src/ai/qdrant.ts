/**
 * Qdrant HTTP client for vector search.
 *
 * The endpoint comes from QUILL_QDRANT_ENDPOINT. Search stays off when
 * that variable is unset.
 */

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

export interface QdrantConfig {
  endpoint: string;
  collectionName: string;
  apiKey?: string;
  maxRetries?: number;
  retryDelay?: number;
}

function envString(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function loadQdrantConfig(override?: Partial<QdrantConfig>): QdrantConfig {
  return {
    endpoint: override?.endpoint?.trim() || envString('QUILL_QDRANT_ENDPOINT') || '',
    collectionName: override?.collectionName || 'maplespike',
    apiKey: override?.apiKey ?? envString('QUILL_QDRANT_API_KEY'),
    maxRetries: override?.maxRetries ?? 2,
    retryDelay: override?.retryDelay ?? 500,
  };
}

function requireQdrantEndpoint(config: QdrantConfig): string {
  const endpoint = config.endpoint.trim().replace(/\/$/, '');
  if (!endpoint) {
    throw new Error('Qdrant is disabled. Set QUILL_QDRANT_ENDPOINT to enable vector search.');
  }
  return endpoint;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface QdrantScoredPoint {
  id: string | number;
  score: number;
  payload?: Record<string, unknown>;
  version?: number;
}

export interface SearchOptions {
  limit?: number;
  scoreThreshold?: number;
  filter?: Record<string, unknown>;
}

export interface QdrantCollectionInfo {
  name: string;
  status: string;
  pointsCount: number;
  vectorsCount: number;
  indexedVectorsCount: number;
  vectorSize: number;
  distance: string;
}

/* ------------------------------------------------------------------ */
/*  Internal HTTP Helper                                               */
/* ------------------------------------------------------------------ */

async function qdrantFetch<T>(
  path: string,
  options: RequestInit = {},
  configOverride?: Partial<QdrantConfig>,
): Promise<T> {
  const config = loadQdrantConfig(configOverride);
  const endpoint = requireQdrantEndpoint(config);
  const url = `${endpoint}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (config.apiKey) {
    headers['api-key'] = config.apiKey;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries!; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Qdrant error (HTTP ${response.status}): ${errorText.slice(0, 500)}`);
      }

      const data: any = await response.json();
      return data as T;
    } catch (error) {
      lastError = error as Error;
      if (attempt < config.maxRetries!) {
        const delay = config.retryDelay! * Math.pow(2, attempt);
        console.error(`[ai/qdrant] Request failed (attempt ${attempt + 1}): ${lastError.message}. Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw new Error(`Qdrant request failed after ${config.maxRetries! + 1} attempts: ${lastError?.message}`);
}

/* ------------------------------------------------------------------ */
/*  Collection Operations                                              */
/* ------------------------------------------------------------------ */

/**
 * Get information about a Qdrant collection.
 */
export async function getCollectionInfo(
  collectionName?: string,
  configOverride?: Partial<QdrantConfig>,
): Promise<QdrantCollectionInfo | null> {
  const config = loadQdrantConfig(configOverride);
  const name = collectionName || config.collectionName;

  try {
    const response = await qdrantFetch<{ result?: Record<string, any> }>(
      `/collections/${encodeURIComponent(name)}`,
      {},
      configOverride,
    );

    if (!response.result) return null;

    const r = response.result;
    const params = (r.config as any)?.params || {};

    return {
      name,
      status: r.status as string || 'unknown',
      pointsCount: (r.points_count as number) ?? 0,
      vectorsCount: (r.vectors_count as number) ?? 0,
      indexedVectorsCount: (r.indexed_vectors_count as number) ?? 0,
      vectorSize: (params.vectors as any)?.size ?? 0,
      distance: (params.vectors as any)?.distance ?? 'Unknown',
    };
  } catch (error) {
    console.error(`[ai/qdrant] Failed to get collection info for "${name}":`, (error as Error).message);
    return null;
  }
}

/**
 * List all collections in Qdrant.
 */
export async function listCollections(
  configOverride?: Partial<QdrantConfig>,
): Promise<string[]> {
  try {
    const response = await qdrantFetch<{ result?: { collections?: { name: string }[] } }>(
      '/collections',
      {},
      configOverride,
    );
    return (response.result?.collections || []).map((c) => c.name);
  } catch (error) {
    console.error('[ai/qdrant] Failed to list collections:', (error as Error).message);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Point Operations                                                   */
/* ------------------------------------------------------------------ */

/**
 * Search a Qdrant collection for points similar to the given vector.
 * Returns scored points sorted by descending relevance.
 */
export async function searchCollection(
  vector: number[],
  options: SearchOptions = {},
  configOverride?: Partial<QdrantConfig>,
): Promise<QdrantScoredPoint[]> {
  const config = loadQdrantConfig(configOverride);
  const { limit = 10, scoreThreshold, filter } = options;

  const body: Record<string, unknown> = {
    vector,
    limit,
    with_payload: true,
  };

  if (scoreThreshold !== undefined) {
    body.score_threshold = scoreThreshold;
  }

  if (filter) {
    body.filter = filter;
  }

  try {
    const response = await qdrantFetch<{ result?: QdrantScoredPoint[] }>(
      `/collections/${encodeURIComponent(config.collectionName)}/points/search`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      configOverride,
    );

    return response.result || [];
  } catch (error) {
    console.error(`[ai/qdrant] Search failed on "${config.collectionName}":`, (error as Error).message);
    return [];
  }
}

/**
 * Upsert (insert or update) points into a Qdrant collection.
 * Each point must have an id, vector, and optional payload.
 */
export async function upsertPoints(
  points: QdrantPoint[],
  configOverride?: Partial<QdrantConfig>,
): Promise<{ status: string; operationId?: number }> {
  const config = loadQdrantConfig(configOverride);

  if (points.length === 0) {
    return { status: 'ok' };
  }

  const body = {
    points: points.map((p) => ({
      id: p.id,
      vector: p.vector,
      payload: p.payload || {},
    })),
  };

  const response = await qdrantFetch<{ result?: { status: string; operation_id?: number } }>(
    `/collections/${encodeURIComponent(config.collectionName)}/points`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
    configOverride,
  );

  return {
    status: response.result?.status || 'unknown',
    operationId: response.result?.operation_id,
  };
}

/**
 * Delete points from a collection by their IDs.
 */
export async function deletePoints(
  ids: (string | number)[],
  configOverride?: Partial<QdrantConfig>,
): Promise<{ status: string }> {
  const config = loadQdrantConfig(configOverride);

  const body = {
    points: ids,
  };

  const response = await qdrantFetch<{ result?: { status: string } }>(
    `/collections/${encodeURIComponent(config.collectionName)}/points/delete`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    configOverride,
  );

  return { status: response.result?.status || 'unknown' };
}

/**
 * Count points in a collection (optionally matching a filter).
 */
export async function countPoints(
  filter?: Record<string, unknown>,
  configOverride?: Partial<QdrantConfig>,
): Promise<number> {
  const config = loadQdrantConfig(configOverride);

  const body: Record<string, unknown> = {};
  if (filter) body.filter = filter;

  try {
    const response = await qdrantFetch<{ result?: { count: number } }>(
      `/collections/${encodeURIComponent(config.collectionName)}/points/count`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      configOverride,
    );
    return response.result?.count ?? 0;
  } catch (error) {
    console.error(`[ai/qdrant] Count failed:`, (error as Error).message);
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/*  Semantic Search Helper                                             */
/* ------------------------------------------------------------------ */

/**
 * Embed a text string using the AI gateway's embeddings endpoint.
 * (Inline helper — avoids cross-package dependency on gateway.ts)
 */
async function embedText(text: string, configOverride?: Partial<QdrantConfig>): Promise<number[] | null> {
  const endpoint = process.env.QUILL_GATEWAY_URL?.trim();
  if (!endpoint) return null;
  const model = process.env.QUILL_EMBED_MODEL || 'nvidia/llama-3.2-nv-embedqa-1b-v2';
  const apiKey = configOverride?.apiKey || process.env.QUILL_GATEWAY_API_KEY;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const resp = await fetch(`${endpoint}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, input: text }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) return null;
    const data = (await resp.json()) as Record<string, unknown>;
    const embedding = (data as any)?.data?.[0]?.embedding;
    return Array.isArray(embedding) ? (embedding as number[]) : null;
  } catch {
    return null;
  }
}

/**
 * Search Qdrant for points semantically similar to the given text.
 *
 * 1. Embeds the text via the AI gateway
 * 2. Searches the collection with the resulting vector
 * 3. Filters results by scoreThreshold if provided
 * 4. Returns scored points with payload
 *
 * Gracefully degrades: returns empty array on failure.
 */
export async function searchSimilar(
  text: string,
  limit = 3,
  scoreThreshold?: number,
  configOverride?: Partial<QdrantConfig>,
): Promise<QdrantScoredPoint[]> {
  if (!text || text.trim().length === 0) return [];

  // Step 1: Embed the query text
  const vector = await embedText(text, configOverride);
  if (!vector) {
    console.error('[ai/qdrant] searchSimilar: embedding failed');
    return [];
  }

  // Step 2: Search Qdrant
  try {
    const results = await searchCollection(vector, {
      limit,
      scoreThreshold,
    }, configOverride);
    return results;
  } catch (error) {
    console.error(`[ai/qdrant] searchSimilar: search failed —`, (error as Error).message);
    return [];
  }
}
