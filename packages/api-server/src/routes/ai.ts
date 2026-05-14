/**
 * MapleSpike — AI Routes
 *
 * Proxies to the cluster's AI Inference Gateway for chat completion,
 * analysis, and semantic search. Falls back to gov/search when the
 * gateway is unreachable.
 *
 * POST /v1/ai_ask       — Ask a natural language question
 * POST /v1/ai/analyze    — Analyze a document/transcript
 * POST /v1/ai/search     — Semantic search via Qdrant
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';

// Gateway endpoint: check multiple env var names for compatibility
// Order: MAPLESPIKE_AI_ENDPOINT > MAPLESPIKE_GATEWAY_URL > AI_ENDPOINT > default
const GATEWAY_ENDPOINT = process.env.MAPLESPIKE_AI_ENDPOINT
  || process.env.MAPLESPIKE_GATEWAY_URL
  || process.env.AI_ENDPOINT
  || 'http://ai-inference-gateway:8080/v1';
const GATEWAY_API_KEY = process.env.MAPLESPIKE_GATEWAY_API_KEY || '';
// Model: check MAPLESPIKE_AI_MODEL > MAPLESPIKE_CHAT_MODEL > AI_MODEL > default
const CHAT_MODEL = process.env.MAPLESPIKE_AI_MODEL
  || process.env.MAPLESPIKE_CHAT_MODEL
  || process.env.AI_MODEL
  || 'Carnice-Qwen3.6-MoE-35B-A3B.IQ4_XS.gguf';
const GOV_SEARCH_ENDPOINT = process.env.MAPLESPIKE_API_URL
  ? `${process.env.MAPLESPIKE_API_URL.replace(/\/+$/, '')}/v1/gov/search`
  : 'http://127.0.0.1:8084/v1/gov/search';

async function gatewayChat(
  messages: Array<{ role: string; content: string }>,
  temperature = 0.3,
  maxTokens = 2048,
): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (GATEWAY_API_KEY) headers['Authorization'] = `Bearer ${GATEWAY_API_KEY}`;

    const resp = await fetch(`${GATEWAY_ENDPOINT}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: CHAT_MODEL,
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

/**
 * POST /v1/ai_ask
 * Ask a natural language question. Tries AI Gateway first,
 * falls back to gov/search, then returns a structured answer.
 */
export const aiAskHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  try {
    const body = await request.json() as { query?: string; source_filter?: string };
    if (!body.query || typeof body.query !== 'string') {
      return jsonResponse(buildError('MISSING_QUERY', 'Field "query" is required', bc), 400);
    }

    const query = body.query.trim();
    if (!query) {
      return jsonResponse(buildError('EMPTY_QUERY', 'Query cannot be empty', bc), 400);
    }

    // Try AI Gateway first
    const systemPrompt = `You are MapleSpike AI, a sovereign Canadian government data assistant.
Answer the user's question about Canadian government data using the available pipeline sources.
Be specific, cite sources where possible, and note limitations.
If you don't know the answer, say so — never fabricate data.
Keep responses concise and factual.`;

    const aiAnswer = await gatewayChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ]);

    if (aiAnswer) {
      return jsonResponse(buildSuccess({
        answer: aiAnswer,
        source: 'ai-gateway',
        model: CHAT_MODEL,
      }, bc));
    }

    // Fallback: gov/search via API server
    const searchResults = await govSearch(query);
    if (searchResults && searchResults.results.length > 0) {
      const answer = `**Search results for "${query}"**\n\nFound ${searchResults.results.length} relevant government data sources:\n\n${searchResults.results.map((r, i) =>
        `${i + 1}. **${r.title}**${r.description ? '\n   ' + r.description.substring(0, 200) : ''}${r.url ? '\n   🔗 ' + r.url : ''}`
      ).join('\n\n')}\n\n— Results from MapleSpike's pipeline data and Government of Canada open data portals.`;

      return jsonResponse(buildSuccess({
        answer,
        source: 'gov-search',
        results: searchResults.results,
      }, bc));
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
    const body = await request.json() as { text?: string; mode?: string };
    if (!body.text || typeof body.text !== 'string') {
      return jsonResponse(buildError('MISSING_TEXT', 'Field "text" is required', bc), 400);
    }

    const mode = body.mode || 'general';
    const systemPrompt = `You are MapleSpike AI. Analyze the following document/transcript.
Mode: ${mode}
Provide: 1) Key topics/themes  2) Notable entities mentioned  3) Overall summary
Be concise and structured.`;

    const aiAnswer = await gatewayChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: body.text.substring(0, 8000) },
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
