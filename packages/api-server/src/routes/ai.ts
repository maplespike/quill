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

// Model verification configuration
const MODEL_VERIFICATION_ENABLED = process.env.MAPLESPIKE_MODEL_VERIFICATION !== 'false';
const MODEL_VERIFICATION_LOGGING = process.env.MAPLESPIKE_MODEL_VERIFICATION_LOGGING !== 'false';
const MODEL_VERIFICATION_ENFORCEMENT = process.env.MAPLESPIKE_MODEL_VERIFICATION_ENFORCEMENT !== 'false';

// Expected model hashes (in production, these would come from secure configuration)
// Using placeholder hashes for development - SHA-256 of empty string
const EXPECTED_MODEL_HASHES: Record<string, string> = {
  'qwen3.5-27b': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'llama3.1-8b': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'mixtral-8x7b': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'gte-large-en-v1.5': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'Carnice-Qwen3.6-MoE-35B-A3B.IQ4_XS.gguf': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
};
const GOV_SEARCH_ENDPOINT = process.env.MAPLESPIKE_API_URL
  ? `${process.env.MAPLESPIKE_API_URL.replace(/\/+$/, '')}/v1/gov/search`
  : 'http://127.0.0.1:8084/v1/gov/search';

async function gatewayChat(
  messages: Array<{ role: string; content: string }>,
  temperature = 0.3,
  maxTokens = 2048,
): Promise<string | null> {
  // Model verification - check if the model hash matches expected value
  if (MODEL_VERIFICATION_ENABLED) {
    const expectedHash = EXPECTED_MODEL_HASHES[CHAT_MODEL];
    if (expectedHash) {
      // In a real implementation, we would verify the actual model file
      // For now, we'll simulate verification by logging that we're checking
      // A real implementation would need access to the model file to compute its hash
      if (MODEL_VERIFICATION_LOGGING) {
        console.info(`[ModelVerification] Verifying model ${CHAT_MODEL} (hash check simulated)`);
      }

      // If enforcement is enabled and we can't verify, we might block
      // For this implementation, we'll allow it to proceed but log the verification status
      // In production, this would actually compute the hash of the model file and compare
    } else if (MODEL_VERIFICATION_ENFORCEMENT) {
      if (MODEL_VERIFICATION_LOGGING) {
        console.warn(`[ModelVerification] No expected hash for model ${CHAT_MODEL} and enforcement is enabled`);
      }
      // Depending on policy, we might want to block the request
      // For now, we'll allow it to proceed but log the warning
    }
  }

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
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      query: { type: 'string', required: true, minLength: 1, maxLength: 5000 },
      source_filter: { type: 'string', maxLength: 200 },
    });
    if (errs.length > 0) {
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: { field: string; message: string }) => e.message).join('; '), bc), 400);
    }

    const query = (body.query as string).trim();

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
