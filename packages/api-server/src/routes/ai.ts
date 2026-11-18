/**
 * Quill — AI Routes
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
import { canAccess } from '../feature-gates.js';
import { portalHost } from '@maplespike/pipeline-core/config/public-base-url';

/**
 * Strip HTML tags and dangerous URI schemes from AI-generated text.
 *
 * The REST API returns JSON, not HTML, but downstream consumers may render
 * `answer`/`analysis` fields in a web UI. LLM output can contain arbitrary
 * markup (e.g. `<script>` injected via prompt injection, or `javascript:`
 * URIs in markdown links). This is a defense-in-depth HTML-strip; it is NOT
 * a full XSS sanitizer.
 *
 * Mirrors the MCP layer's `sanitizeString` (server.ts) but scoped to the
 * HTML-injection threat model — the REST layer does NOT do PII redaction
 * (that belongs to the MCP/pipeline layer where tool results carry PII).
 */
function sanitizeString(val: string): string {
  return val
    // Strip <script>, <style>, <iframe>, <object>, <embed> blocks first
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    // Strip all remaining tags (this also kills any attribute payloads)
    .replace(/<[^>]+>/g, '')
    // Defense-in-depth: scrub dangerous URI schemes from the remaining text
    // so a downstream markdown renderer cannot turn `[x](javascript:…)` into
    // a clickable link. HTML parsers normalize tabs/newlines inside URLs, so
    // match whitespace and control chars interleaved through the scheme name
    // (also strips "Java script:" prose — an acceptable tradeoff for catching
    // `java\tscript:` obfuscation; the regex requires a trailing colon, so
    // plain mentions of "javascript" in text are untouched).
    // eslint-disable-next-line no-control-regex -- control chars are intentional: stripping obfuscated scheme names
    .replace(/j[\s\u0000-\u001f]*a[\s\u0000-\u001f]*v[\s\u0000-\u001f]*a[\s\u0000-\u001f]*s[\s\u0000-\u001f]*c[\s\u0000-\u001f]*r[\s\u0000-\u001f]*i[\s\u0000-\u001f]*p[\s\u0000-\u001f]*t[\s\u0000-\u001f]*:/gi, '')
    // eslint-disable-next-line no-control-regex -- control chars are intentional: stripping obfuscated scheme names
    .replace(/v[\s\u0000-\u001f]*b[\s\u0000-\u001f]*s[\s\u0000-\u001f]*c[\s\u0000-\u001f]*r[\s\u0000-\u001f]*i[\s\u0000-\u001f]*p[\s\u0000-\u001f]*t[\s\u0000-\u001f]*:/gi, '');
}

// ── AI Gateway ──────────────────────────────────────────────────────
// Order: QUILL_AI_ENDPOINT > QUILL_GATEWAY_URL > AI_ENDPOINT. Unset means off.
function envValue(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return '';
}

function gatewayEndpoint(): string {
  return envValue('QUILL_AI_ENDPOINT', 'QUILL_GATEWAY_URL', 'AI_ENDPOINT');
}

const GATEWAY_API_KEY = process.env.QUILL_GATEWAY_API_KEY || '';
// Model: check QUILL_AI_MODEL > QUILL_CHAT_MODEL > AI_MODEL > default
const CHAT_MODEL = process.env.QUILL_AI_MODEL
  || process.env.QUILL_CHAT_MODEL
  || process.env.AI_MODEL
  || 'qwen3.5-4b-local';
const LOCAL_MODEL = process.env.QUILL_LOCAL_MODEL || 'Qwen3.5-4B-Q4_K_M.gguf';
// Embedding model
const EMBED_MODEL = process.env.QUILL_EMBED_MODEL
  || 'nvidia/llama-3.2-nv-embedqa-1b-v2';

// ── Qdrant Vector DB ───────────────────────────────────────────────
// QUILL_QDRANT_ENDPOINT. Unset means semantic search is off.
function qdrantEndpoint(): string {
  return envValue('QUILL_QDRANT_ENDPOINT');
}
const QDRANT_COLLECTION = process.env.QUILL_QDRANT_COLLECTION
  || 'brain_wiki';

// ── Gov/Keyword Search Fallback ────────────────────────────────────
const GOV_SEARCH_ENDPOINT = process.env.QUILL_API_URL
  ? `${process.env.QUILL_API_URL.replace(/\/+$/, '')}/v1/gov/search`
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
    const requestedModel = config?.model || CHAT_MODEL;
    const isLocalModel = requestedModel.includes('local') || requestedModel.includes('gguf');
    const apiKey = config?.apiKey || GATEWAY_API_KEY;

    if (isLocalModel) {
      // Local llama.cpp models: use completions endpoint with Qwen chat format
      const localUrl = process.env.QUILL_LOCAL_ENDPOINT || 'http://localhost:8001/v1';
      const localModel = process.env.QUILL_LOCAL_MODEL || requestedModel;

      // Build Qwen-style chat prompt with actual newlines
      const prompt = messages.map(m => {
        const role = m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : 'assistant';
        return `<|im_start|>${role}\n${m.content}<|im_end|>\n`;
      }).join('') + '<|im_start|>assistant\n';

      const resp = await fetch(`${localUrl}/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` }: {}) },
        body: JSON.stringify({
          model: localModel,
          prompt,
          max_tokens: maxTokens,
          temperature,
          stop: ['<|im_end|>', '<|im_start|>'],
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!resp.ok) return null;
      const data = await resp.json() as any;
      return data?.choices?.[0]?.text ?? null;
    }

    // Standard OpenAI-compatible chat completions (gateway or BYOK)
    const endpoint = (config?.endpoint || gatewayEndpoint()).trim();
    if (!endpoint) return null;
    const chatModel = config?.model || CHAT_MODEL;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const resp = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: chatModel,
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

/* ================================================================== */
/*  Fusion Gateway — Circuit Breaker                                   */
/* ================================================================== */

/**
 * Circuit breaker state for the fusion gateway (/v1/chat/completions).
 *
 * When the fusion endpoint returns 5xx errors, we track them in a
 * sliding 1-minute window. After `threshold` failures (default 3),
 * we trip the breaker and fall back to direct Qdrant search + the
 * existing gatewayChat LLM path.
 */
function fusionEndpoint(): string {
  return envValue('QUILL_FUSION_ENDPOINT');
}
const FUSION_API_KEY = process.env.QUILL_GATEWAY_API_KEY || '';
const FUSION_MODEL = process.env.QUILL_FUSION_MODEL
  || process.env.QUILL_AI_MODEL
  || 'qwen3.5-4b-local';

interface CircuitBreakerState {
  failureCount: number;
  failureWindowStart: number;
  threshold: number;
  windowMs: number;
  isOpen: boolean;
  cooldownUntil: number;
}

const fusionBreaker: CircuitBreakerState = {
  failureCount: 0,
  failureWindowStart: Date.now(),
  threshold: 3,
  windowMs: 60_000,        // 1 minute sliding window
  isOpen: false,
  cooldownUntil: 0,
};

/**
 * Check whether the fusion gateway circuit breaker is open.
 * Resets the window if it has expired.
 */
function isFusionCircuitOpen(): boolean {
  if (!fusionBreaker.isOpen) return false;
  if (Date.now() > fusionBreaker.cooldownUntil) {
    fusionBreaker.isOpen = false;
    fusionBreaker.failureCount = 0;
    fusionBreaker.failureWindowStart = Date.now();
    return false;
  }
  return true;
}

/**
 * Record a fusion gateway failure. If the window has elapsed since
 * the first failure, reset the count. If `threshold` is reached,
 * trip the breaker for a 2-minute cooldown.
 */
function recordFusionFailure(): void {
  const now = Date.now();

  // Reset the window if it has elapsed
  if (now - fusionBreaker.failureWindowStart > fusionBreaker.windowMs) {
    fusionBreaker.failureCount = 0;
    fusionBreaker.failureWindowStart = now;
  }

  fusionBreaker.failureCount++;

  if (fusionBreaker.failureCount >= fusionBreaker.threshold) {
    fusionBreaker.isOpen = true;
    fusionBreaker.cooldownUntil = now + 120_000; // 2 min cooldown
    console.error(`[ai/fusion] Circuit breaker OPEN — ${fusionBreaker.failureCount} failures in window. Cooling down until ${new Date(fusionBreaker.cooldownUntil).toISOString()}`);
  }
}

/**
 * Record a fusion gateway success (resets the failure window).
 */
function recordFusionSuccess(): void {
  fusionBreaker.failureCount = 0;
  fusionBreaker.failureWindowStart = Date.now();
}

/**
 * Send a chat completion request to the fusion gateway.
 *
 * The fusion gateway is an OpenAI-compatible endpoint at
 * /v1/chat/completions. It may host a different model than the
 * existing gatewayChat path (e.g. Qwen3.5-4B local vs the gateway's
 * default model).
 *
 * Returns the response text on success, or null on failure.
 * On 5xx errors, records a circuit breaker failure.
 */
async function callFusionGateway(
  messages: Array<{ role: string; content: string }>,
  options: {
    temperature?: number;
    maxTokens?: number;
    endpoint?: string;
    model?: string;
    signal?: AbortSignal;
  } = {},
): Promise<string | null> {
  // Check circuit breaker
  if (isFusionCircuitOpen()) {
    console.warn('[ai/fusion] Circuit breaker is OPEN — skipping fusion gateway');
    return null;
  }

  const configured = (options.endpoint || fusionEndpoint()).trim();
  if (!configured) return null;
  const endpoint = configured.replace(/\/$/, '');
  const model = options.model || FUSION_MODEL;
  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 2048;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (FUSION_API_KEY) {
    headers['Authorization'] = `Bearer ${FUSION_API_KEY}`;
  }

  try {
    const resp = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: options.signal ?? AbortSignal.timeout(60_000),
    });

    if (!resp.ok) {
      // 5xx → circuit breaker failure
      if (resp.status >= 500) {
        recordFusionFailure();
        console.error(`[ai/fusion] 5xx error (${resp.status}) — circuit breaker recorded`);
      }
      return null;
    }

    // Success — reset circuit breaker
    recordFusionSuccess();

    const data = (await resp.json()) as Record<string, unknown>;
    const result = (data as any)?.choices?.[0]?.message?.content;
    return typeof result === 'string' ? result : null;
  } catch (err) {
    // Network error — don't count toward circuit breaker (it's transient)
    console.error(`[ai/fusion] Request failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Embed a query string using the AI Gateway's embeddings endpoint.
 * Returns the vector array on success, or null on failure.
 */
async function embedQuery(text: string): Promise<number[] | null> {
  // Try local llama.cpp embeddings endpoint first (fast, on sentry)
  try {
    const localUrl = process.env.QUILL_LOCAL_ENDPOINT || 'http://localhost:8001/v1';
    const resp = await fetch(`${localUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text }),
      signal: AbortSignal.timeout(15000),
    });
    if (resp.ok) {
      const data = await resp.json() as any;
      const embedding = data?.data?.[0]?.embedding;
      if (embedding && Array.isArray(embedding)) return embedding as number[];
    }
  } catch {
    // Fall through to AI Gateway
  }

  // Fallback: AI Gateway embeddings
  const gateway = gatewayEndpoint();
  if (!gateway) return null;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (GATEWAY_API_KEY) headers['Authorization'] = `Bearer ${GATEWAY_API_KEY}`;

    const resp = await fetch(`${gateway}/embeddings`, {
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

/**
 * Structural type for the Qdrant `/collections/:name` endpoint response.
 * We only read the fields used by qdrantVectorSearch; unknown fields are
 * preserved to avoid surprises if Qdrant adds new top-level keys later.
 */
interface QdrantCollectionInfoResponse {
  result?: {
    points_count?: number;
    config?: {
      params?: {
        vectors?: {
          size?: number;
          distance?: string;
        };
      };
    };
  };
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
  const configured = qdrantEndpoint();
  if (!configured) return null;
  try {
    const endpoint = configured.replace(/\/$/, '');
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
        const infoData = await infoResp.json() as QdrantCollectionInfoResponse;
        const r = infoData.result;
        if (r) {
          const vectors = r.config?.params?.vectors;
          collectionInfo = {
            pointsCount: r.points_count ?? 0,
            vectorSize: vectors?.size ?? 0,
            distance: vectors?.distance ?? 'Unknown',
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
  if (!qdrantEndpoint()) return null;
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

  // ── Feature gate: RAG-powered AI requires Pro tier or higher ──
  if (!canAccess(ctx.tenant.tier, 'aiRag')) {
    return jsonResponse(buildError('UPGRADE_REQUIRED',
      `AI queries with RAG require a Pro plan or higher. Upgrade at ${portalHost()}/billing.`,
      bc), 402);
  }

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

    // ── Step 4: Try Fusion Gateway with RAG context (primary) ────────
    // Fusion gateway gets the full RAG-enhanced prompt and Qdrant context.
    // If it succeeds, return the structured answer.
    let aiAnswer: string | null = null;
    let usedProvider = '';

    if (searchSource === 'qdrant' && ragContext) {
      aiAnswer = await callFusionGateway([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Question: ${query}\n\nUse the context above (if any) to answer. Cite sources as [1], [2], etc.` },
      ], { temperature: 0.3, maxTokens: 2048 });

      if (aiAnswer) {
        usedProvider = 'fusion';
      } else {
        console.log('[ai/ask] Fusion gateway unavailable — falling back to standard gateway');
      }
    }

    // ── Step 5: Fallback — try standard AI Gateway with RAG context ──
    if (!aiAnswer) {
      aiAnswer = await gatewayChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Question: ${query}\n\nUse the context above (if any) to answer. Cite sources as [1], [2], etc.` },
      ], 0.3, 2048, aiConfig);

      if (aiAnswer) {
        usedProvider = aiConfig.source;
      }
    }

    if (aiAnswer) {
      const sanitizedAnswer = sanitizeString(aiAnswer);
      return jsonResponse(buildSuccess({
        answer: sanitizedAnswer,
        source: usedProvider || aiConfig.source,
        model: usedProvider === 'fusion' ? FUSION_MODEL : aiConfig.model,
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
      answer: `I searched the Quill for "${query}" but couldn't find relevant results. Try a different query, or browse the data categories in the [Explorer](explorer.html).`,
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

  // ── Feature gate: AI analysis requires Pro tier or higher ──
  if (!canAccess(ctx.tenant.tier, 'aiAnalyze')) {
    return jsonResponse(buildError('UPGRADE_REQUIRED',
      `AI document analysis requires a Pro plan or higher. Upgrade at ${portalHost()}/billing.`,
      bc), 402);
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      text: { type: 'string', required: true, minLength: 1, maxLength: 50000 },
      mode: { type: 'string', maxLength: 50 },
    });
    if (errs.length > 0) {
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: { field: string; message: string }) => e.message).join('; '), bc), 400);
    }

    if (!gatewayEndpoint()) {
      return jsonResponse(buildError(
        'AI_DISABLED',
        'AI gateway is disabled. Set QUILL_AI_ENDPOINT, QUILL_GATEWAY_URL, or AI_ENDPOINT to enable document analysis.',
        bc,
      ), 503);
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
      const sanitizedAnalysis = sanitizeString(aiAnswer);
      return jsonResponse(buildSuccess({
        analysis: sanitizedAnalysis,
        model: CHAT_MODEL,
        mode,
      }, bc));
    }

    return jsonResponse(buildError('AI_UNAVAILABLE', 'AI Gateway is not reachable. The AI inference cluster may be down.', bc), 503);
  } catch (err) {
    return jsonResponse(buildError('ANALYZE_ERROR', (err as Error).message, bc), 500);
  }
};
