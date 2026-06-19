/**
 * MapleSpike — AI Routes
 *
 * Proxies to the cluster's AI Inference Gateway for chat completion,
 * analysis, and semantic search. Uses Qdrant vector DB for RAG context
 * retrieval (semantic search), with gov/search keyword fallback.
 *
 * POST /v1/ai_ask (deprecated) — Ask a natural language question
 * POST /v1/ai/ask           — Ask a natural language question (recommended)
 * POST /v1/ai/analyze       — Analyze a document/transcript
 * POST /v1/ai/search        — Semantic search via Qdrant
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { validateBody } from '../validate.js';
import { resolveAIConfig } from './ai-settings.js';

// ── AI Gateway ──────────────────────────────────────────────────────
// Order: MAPLESPIKE_AI_ENDPOINT > MAPLESPIKE_GATEWAY_URL > AI_ENDPOINT > default
const GATEWAY_ENDPOINT = process.env.MAPLESPIKE_AI_ENDPOINT
  || process.env.MAPLESPIKE_GATEWAY_URL
  || process.env.AI_ENDPOINT
  || 'http://ai-inference-gateway.ai-inference.svc.cluster.local:8080/v1';
const GATEWAY_API_KEY = process.env.MAPLESPIKE_GATEWAY_API_KEY || '';
// Model: check MAPLESPIKE_AI_MODEL > MAPLESPIKE_CHAT_MODEL > AI_MODEL > default
const CHAT_MODEL = process.env.MAPLESPIKE_AI_MODEL
  || process.env.MAPLESPIKE_CHAT_MODEL
  || process.env.AI_MODEL
  || 'glm-5.2';
// Embedding model
const EMBED_MODEL = process.env.MAPLESPIKE_EMBED_MODEL
  || 'nvidia/llama-3.2-nv-embedqa-1b-v2';

// ── Qdrant Vector DB ───────────────────────────────────────────────
// Override via MAPLESPIKE_QDRANT_ENDPOINT; default matches cluster DNS
const QDRANT_ENDPOINT = process.env.MAPLESPIKE_QDRANT_ENDPOINT
  || 'http://qdrant.ai-inference.svc.cluster.local:6333';
const QDRANT_COLLECTION = process.env.MAPLESPIKE_QDRANT_COLLECTION
  || 'brain_wiki';

// ── Gov/Keyword Search Fallback ────────────────────────────────────
const GOV_SEARCH_ENDPOINT = process.env.MAPLESPIKE_API_URL
  ? `${process.env.MAPLESPIKE_API_URL.replace(/\/+$/, '')}/v1/gov/search`
  : 'http://localhost:8082/v1/gov/search';


/* ================================================================== */
/*  AI Gateway Helpers                                                 */
/* ================================================================== */

async function gatewayChat(
  messages: Array<{ role: string; content: string }>,
  temperature = 0.3,
  maxTokens = 2048,
  config?: { endpoint: string; apiKey: string; model: string },
): Promise<string | null> {
  try {
    const endpoint = config?.endpoint || GATEWAY_ENDPOINT;
    const model = config?.model || CHAT_MODEL;
    const apiKey = config?.apiKey || GATEWAY_API_KEY;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const resp = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

/**
 * Embed a query string using the AI Gateway's embeddings endpoint.
 * Returns the vector array on success, or null on failure.
 */
async function embedQuery(text: string): Promise<number[] | null> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (GATEWAY_API_KEY) headers['Authorization'] = `Bearer ${GATEWAY_API_KEY}`;

    const resp = await fetch(`${GATEWAY_ENDPOINT}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: text,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    const embedding = data?.data?.[0]?.embedding;
    if (!embedding || !Array.isArray(embedding)) return null;
    return embedding as number[];
  } catch {
    return null;
  }
}


/* ================================================================== */
/*  Qdrant HTTP Client (inline — no cross-package import)             */
/* ================================================================== */

interface QdrantScoredPoint {
  id: string | number;
  score: number;
  payload?: Record<string, unknown>;
  version?: number;
}

interface QdrantSearchResult {
  results: Array<{
    id: string | number;
    score: number;
    title: string;
    description: string;
    url: string;
    source: string;
    sourceType: string;
    payload: Record<string, unknown>;
  }>;
  collectionInfo: {
    pointsCount: number;
    vectorSize: number;
    distance: string;
  } | null;
}

/**
 * Search Qdrant by embedding vector. Returns formatted results with
 * payload fields mapped to a consistent shape, or null on failure.
 */
async function qdrantVectorSearch(vector: number[], limit = 10): Promise<QdrantSearchResult | null> {
  try {
    const endpoint = QDRANT_ENDPOINT.replace(/\/$/, '');
    const url = `${endpoint}/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points/search`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vector,
        limit,
        with_payload: true,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;

    const data = await resp.json() as any;
    const points: QdrantScoredPoint[] = data?.result ?? [];
    if (points.length === 0) return null;

    // Fetch collection info for dimension/distance metadata
    let collectionInfo: QdrantSearchResult['collectionInfo'] = null;
    try {
      const infoResp = await fetch(`${endpoint}/collections/${encodeURIComponent(QDRANT_COLLECTION)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (infoResp.ok) {
        const infoData = await infoResp.json() as any;
        const r = infoData?.result;
        if (r) {
          const params = (r.config as any)?.params || {};
          collectionInfo = {
            pointsCount: (r.points_count as number) ?? 0,
            vectorSize: (params.vectors as any)?.size ?? 0,
            distance: (params.vectors as any)?.distance ?? 'Unknown',
          };
        }
      }
    } catch {
      // Non-critical — proceed without collection metadata
    }

    return {
      results: points.map((p) => {
        const payload = p.payload ?? {};
        return {
          id: p.id,
          score: Math.round(p.score * 1000) / 1000,
          title: (payload.title as string)
            || (payload.name as string)
            || (payload.source_title as string)
            || `Document ${p.id}`,
          description: ((payload.description as string)
            || (payload.notes as string)
            || (payload.summary as string)
            || '').substring(0, 400),
          url: (payload.url as string)
            || (payload.source_url as string)
            || '#',
          source: (payload.organization as string)
            || (payload.source as string)
            || (payload.source_type as string)
            || 'Qdrant',
          sourceType: (payload.source_type as string)
            || (payload.type as string)
            || 'unknown',
          payload,
        };
      }),
      collectionInfo,
    };
  } catch {
    return null;
  }
}

/**
 * Full semantic search pipeline: embed + search Qdrant.
 * Returns null if either step fails (caller should fall back).
 */
async function qdrantSearch(query: string, limit = 10): Promise<QdrantSearchResult | null> {
  const vector = await embedQuery(query);
  if (!vector) return null;
  return qdrantVectorSearch(vector, limit);
}


/* ================================================================== */
/*  Gov/Keyword Search Fallback                                       */
/* ================================================================== */

async function govSearch(query: string): Promise<{
  results: Array<{ title: string; description: string; url: string; source: string }>;
} | null> {
  try {
    const resp = await fetch(`${GOV_SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}&limit=8`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    if (!data?.success || !data?.data?.results) return null;

    const pipeline = data.data.results.pipeline || [];
    const ckan = data.data.results.ckan || [];
    const allResults = [...pipeline, ...ckan].slice(0, 8);

    return {
      results: allResults.map((r: any) => ({
        title: r.title || r.name || 'Dataset',
        description: (r.notes || r.description || '').substring(0, 300),
        url: r.url || '#',
        source: r.organization?.title || r.source || 'Government of Canada',
      })),
    };
  } catch {
    return null;
  }
}


/* ================================================================== */
/*  Handlers                                                           */
/* ================================================================== */

/**
 * POST /v1/ai_ask (DEPRECATED - use POST /v1/ai/ask instead)
 * POST /v1/ai/ask
 *
 * Ask a natural language question. Uses RAG via Qdrant semantic search:
 *   1) Embed the user's query via AI Gateway
 *   2) Search Qdrant for semantically similar documents
 *   3) Inject results as context into the system prompt
 *   4) Send to LLM for a cited answer with Qdrant source references
 *
 * Falls back to gov/keyword search if Qdrant is unreachable.
 */
export const aiAskHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      query: { type: 'string', required: true, minLength: 1, maxLength: 5000 },
      source_filter: { type: 'string', maxLength: 200 },
    });
    if (errs.length > 0) {
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: { field: string; message: string }) => e.message).join('; '), bc), 400);
    }

    const query = (body.query as string).trim();
    const sourceFilter = (body.source_filter as string) || '';

    // ── Step 1: RAG — Qdrant semantic search (primary) ──────────────
    let ragContext = '';
    let sourceCount = 0;
    let searchSource = 'none';
    let qdrantMeta: { collection?: string; pointsCount?: number; vectorSize?: number; distance?: string } | undefined;

    // Try Qdrant semantic search first
    try {
      const qdrantResult = await qdrantSearch(query, 8);
      if (qdrantResult && qdrantResult.results.length > 0) {
        // Optionally apply source_type filter client-side if provided
        let filtered = qdrantResult.results;
        if (sourceFilter) {
          const sf = sourceFilter.toLowerCase();
          filtered = filtered.filter((r) => r.sourceType.toLowerCase().includes(sf));
        }
        sourceCount = filtered.length;
        searchSource = 'qdrant';
        qdrantMeta = {
          collection: QDRANT_COLLECTION,
          pointsCount: qdrantResult.collectionInfo?.pointsCount,
          vectorSize: qdrantResult.collectionInfo?.vectorSize,
          distance: qdrantResult.collectionInfo?.distance,
        };

        if (filtered.length > 0) {
          ragContext = '\n\nRelevant context retrieved via semantic search (Qdrant vector DB):\n' +
            filtered.map((r, i) =>
              `[${i + 1}] ${r.title}\n` +
              `    Description: ${r.description}\n` +
              `    Source: ${r.source}\n` +
              `    Type: ${r.sourceType}\n` +
              `    Relevance: ${r.score}\n` +
              (r.url && r.url !== '#' ? `    URL: ${r.url}\n` : '')
            ).join('\n');
        }
      }
    } catch {
      // Qdrant failed — will fall through to gov/search below
    }

    // Fall back to gov/keyword search if Qdrant returned nothing
    if (sourceCount === 0) {
      try {
        const govResp = await fetch(`${GOV_SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}&limit=10`, {
          signal: AbortSignal.timeout(8000),
        });
        if (govResp.ok) {
          const govData = await govResp.json() as any;
          if (govData?.success && govData?.data?.results) {
            const pipeline = govData.data.results.pipeline || [];
            const ckan = govData.data.results.ckan || [];
            const allResults = [...pipeline, ...ckan].slice(0, 10);
            sourceCount = allResults.length;
            searchSource = 'gov-search';

            if (allResults.length > 0) {
              ragContext = '\n\nRelevant government data sources retrieved from MapleSpike:\n' +
                allResults.map((r: any, i: number) =>
                  `[${i + 1}] ${r.title || r.name || 'Dataset'}\n` +
                  `    Description: ${(r.notes || r.description || '').substring(0, 400)}\n` +
                  `    Source: ${r.organization?.title || r.source || 'Government of Canada'}\n` +
                  (r.url ? `    URL: ${r.url}\n` : '')
                ).join('\n');
            }
          }
        }
      } catch {
        // gov/search unavailable — continue without RAG context
      }
    }

    // ── Step 2: Build RAG-enhanced system prompt ─────────────────────
    const sourceLabel = searchSource === 'qdrant' ? 'semantic search (Qdrant vector DB)'
      : searchSource === 'gov-search' ? 'keyword search'
      : '';

    const systemPrompt = `You are MapleSpike AI, a sovereign Canadian government data assistant.

Answer the user's question about Canadian government data using the provided context.
Be specific, cite sources by their [number] references, and note limitations.
If the context doesn't contain enough information, say so clearly — never fabricate data.
Keep responses concise and factual.${ragContext}`;

    // ── Step 3: Resolve AI config (BYOK or cluster default) ──────────
    const aiConfig = resolveAIConfig(ctx.tenant.id);

    // ── Step 4: Try AI Gateway with RAG context ──────────────────────
    const aiAnswer = await gatewayChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Question: ${query}\n\nUse the context above (if any) to answer. Cite sources as [1], [2], etc.` },
    ], 0.3, 2048, aiConfig);

    if (aiAnswer) {
      return jsonResponse(buildSuccess({
        answer: aiAnswer,
        source: aiConfig.source,
        model: aiConfig.model,
        ragSource: searchSource,          // 'qdrant' or 'gov-search'
        contextSources: sourceCount,
        ...(searchSource === 'qdrant' && qdrantMeta ? { qdrant: qdrantMeta } : {}),
      }, bc));
    }

    // ── Fallback: raw search results (when AI Gateway is unreachable) ─
    if (searchSource === 'qdrant') {
      // Re-run Qdrant search for display purposes (or re-use cached)
      const displayResults = await qdrantSearch(query, 8);
      if (displayResults && displayResults.results.length > 0) {
        const answer = `**Semantic search results for "${query}"**\n\nFound ${displayResults.results.length} relevant documents via semantic search:\n\n${displayResults.results.map((r, i) =>
          `${i + 1}. **${r.title}**${r.description ? '\n   ' + r.description.substring(0, 200) : ''}${r.url && r.url !== '#' ? '\n   🔗 ' + r.url : ''}`
        ).join('\n\n')}\n\n— Results from Qdrant vector search (collection: ${QDRANT_COLLECTION}, similarity: ${qdrantMeta?.distance || 'Cosine'}).` +
        (qdrantMeta?.vectorSize ? ` Embedding dimension: ${qdrantMeta.vectorSize}.` : '');

        return jsonResponse(buildSuccess({
          answer,
          source: 'qdrant',
          results: displayResults.results,
          qdrant: qdrantMeta,
        }, bc));
      }
    }

    if (searchSource === 'gov-search') {
      const fallbackResults = await govSearch(query);
      if (fallbackResults && fallbackResults.results.length > 0) {
        const answer = `**Search results for "${query}"**\n\nFound ${fallbackResults.results.length} relevant government data sources:\n\n${fallbackResults.results.map((r, i) =>
          `${i + 1}. **${r.title}**${r.description ? '\n   ' + r.description.substring(0, 200) : ''}${r.url ? '\n   🔗 ' + r.url : ''}`
        ).join('\n\n')}\n\n— Results from MapleSpike's pipeline data and Government of Canada open data portals.`;

        return jsonResponse(buildSuccess({
          answer,
          source: 'gov-search',
          results: fallbackResults.results,
        }, bc));
      }
    }

    // Last resort
    return jsonResponse(buildSuccess({
      answer: `I searched the MapleSpike pipeline for "${query}" but couldn't find relevant results. Try a different query, or browse the data categories in the [Explorer](explorer.html).`,
      source: 'none',
    }, bc));
  } catch (err) {
    return jsonResponse(buildError('AI_ERROR', (err as Error).message, bc), 500);
  }
};

/**
 * POST /v1/ai/analyze
 * Analyze a document or transcript for topics, sentiment, entities.
 */
export const aiAnalyzeHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      text: { type: 'string', required: true, minLength: 1, maxLength: 50000 },
      mode: { type: 'string', maxLength: 50 },
    });
    if (errs.length > 0) {
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: { field: string; message: string }) => e.message).join('; '), bc), 400);
    }

    const mode = (body.mode as string) || 'general';
    const systemPrompt = `You are MapleSpike AI. Analyze the following document/transcript.
Mode: ${mode}
Provide: 1) Key topics/themes  2) Notable entities mentioned  3) Overall summary
Be concise and structured.`;

    const aiAnswer = await gatewayChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: (body.text as string).substring(0, 8000) },
    ]);

    if (aiAnswer) {
      return jsonResponse(buildSuccess({
        analysis: aiAnswer,
        model: CHAT_MODEL,
        mode,
      }, bc));
    }

    return jsonResponse(buildError('AI_UNAVAILABLE', 'AI Gateway is not reachable. The AI inference cluster may be down.', bc), 503);
  } catch (err) {
    return jsonResponse(buildError('ANALYZE_ERROR', (err as Error).message, bc), 500);
  }
};
