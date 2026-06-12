/**
 * MapleSpike — AI Routes
 *
 * Proxies to the cluster's AI Inference Gateway for chat completion,
 * analysis, and semantic search. Falls back to gov/search when the
 * gateway is unreachable.
 *
 * POST /v1/ai_ask (deprecated) — Ask a natural language question
 * POST /v1/ai/ask           — Ask a natural language question (recommended)
 * POST /v1/ai/analyze       — Analyze a document/transcript
 * POST /v1/ai/search        — Semantic search via Qdrant
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { validateBody } from '../validate.js';

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
 * POST /v1/ai_ask (DEPRECATED - use POST /v1/ai/ask instead)
 * Ask a natural language question. Uses RAG: searches pipeline data first,
 * injects results as context, then sends to LLM for a cited answer.
 * Falls back to gov/search when the gateway is unreachable.
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

    // ── Step 1: RAG — search pipeline data for relevant context ──────────
    let ragContext = '';
    let sourceCount = 0;
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

    // ── Step 2: Build RAG-enhanced system prompt ─────────────────────────
    const systemPrompt = `You are MapleSpike AI, a sovereign Canadian government data assistant.

Answer the user's question about Canadian government data using the provided context.
Be specific, cite sources by their [number] references, and note limitations.
If the context doesn't contain enough information, say so clearly — never fabricate data.
Keep responses concise and factual.${ragContext}`;

    // ── Step 3: Try AI Gateway with RAG context ──────────────────────────
    const aiAnswer = await gatewayChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Question: ${query}\n\nUse the context above (if any) to answer. Cite sources as [1], [2], etc.` },
    ]);

    if (aiAnswer) {
      return jsonResponse(buildSuccess({
        answer: aiAnswer,
        source: 'ai-gateway',
        model: CHAT_MODEL,
        contextSources: sourceCount,
      }, bc));
    }

    // ── Fallback: gov/search results (raw listing) ───────────────────────
    if (sourceCount > 0) {
      // Re-fetch results for fallback display
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
