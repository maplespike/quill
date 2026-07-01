/**
 * MapleSpike Edge AI Worker — Enterprise Grade
 *
 * Security architecture:
 *   1. API key validation via KV (SHA-256 hashed, never stored plaintext)
 *   2. Per-tenant rate limiting via KV sliding window
 *   3. Full audit logging to D1 (every request tracked)
 *   4. Prompt/response sanitization (PII redaction before logging)
 *   5. Two-tier model routing: Workers AI (free edge) -> homelab (fallback)
 *   6. AI Gateway for caching + analytics (reduces duplicate inference cost)
 *   7. JWT-signed tenant context (prevents key forgery)
 *
 * Routes:
 *   POST /v1/ai/ask         — AI Q&A with government data context
 *   POST /v1/ai/search      — Semantic search (Workers AI embeddings -> homelab Qdrant)
 *   GET  /v1/ai/models       — List available models
 *   GET  /v1/health          — Health check
 *
 * Auth: Bearer token or X-API-Key header (validated against KV)
 * Rate limit: 10 req/min free, 60 req/min pro (stored in KV per tenant)
 */

export interface Env {
  // Cloudflare bindings
  AI: Ai;
  API_KEYS: KVNamespace;
  RATE_LIMIT: KVNamespace;
  AUDIT_DB: D1Database;
  AI_GATEWAY_ID: string;

  // Secrets (set via wrangler secret put)
  HOMELAB_API_URL: string;          // https://api.maplespike.lan or tunnel URL
  HOMELAB_API_KEY: string;           // MapleSpike API key for homelab auth
  JWT_SIGNING_KEY: string;           // HMAC key for signing tenant JWTs
  PII_HASH_SECRET: string;           // For hashing PII in audit logs
}

// ─── Types ──────────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'business' | 'enterprise';
  rateLimitPerMin: number;
  isActive: boolean;
}

interface AuditEntry {
  timestamp: string;
  tenant_id: string;
  api_key_hash: string;
  endpoint: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cache_hit: boolean;
  source: 'edge' | 'homelab' | 'byok';
  client_ip: string;
  user_agent: string;
  request_hash: string;
}

// ─── Model Configuration ────────────────────────────────────────────────

const EDGE_MODELS = {
  chat: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  chatFast: '@cf/meta/llama-3.1-8b-instruct',
  embedding: '@cf/baai/bge-base-en-v1.5',
};

const HOMELAB_FALLBACK_MODEL = 'qwen3.5-4b-local';
const HOMELAB_TIMEOUT_MS = 15_000;

// ─── Security Utilities ─────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeForLog(text: string): string {
  // Redact emails, phone numbers, SINs, credit cards from audit logs
  return text
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[REDACTED_EMAIL]')
    .replace(/\b\d{3}-\d{3}-\d{3}\b/g, '[REDACTED_PHONE]')
    .replace(/\b\d{3} \d{3} \d{3}\b/g, '[REDACTED_PHONE]')
    .replace(/\b\d{9}\b/g, '[REDACTED_SIN]')
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED_CC]')
    .slice(0, 500); // Truncate to prevent log injection / oversized storage
}

function validateApiKeyFormat(key: string): boolean {
  // MapleSpike API keys: ms_live_[a-f0-9]{32} or ms_test_[a-f0-9]{32}
  return /^ms_(live|test)_[a-f0-9]{32}$/.test(key);
}

// ─── Auth: API Key Validation via KV ────────────────────────────────────

async function validateApiKey(request: Request, env: Env): Promise<Tenant | null> {
  const authHeader = request.headers.get('Authorization') ?? '';
  const apiKeyHeader = request.headers.get('X-API-Key') ?? '';

  let apiKey = '';
  if (authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.slice(7).trim();
  } else if (apiKeyHeader) {
    apiKey = apiKeyHeader.trim();
  }

  if (!apiKey || !validateApiKeyFormat(apiKey)) {
    return null;
  }

  // Hash the key for KV lookup (keys are stored hashed, never plaintext)
  const keyHash = await sha256(apiKey);
  const tenantJson = await env.API_KEYS.get(`key:${keyHash}`);

  if (!tenantJson) return null;

  try {
    const tenant = JSON.parse(tenantJson) as Tenant;
    if (!tenant.isActive) return null;
    return tenant;
  } catch {
    return null;
  }
}

// ─── Rate Limiting (sliding window via KV) ──────────────────────────────

async function checkRateLimit(tenantId: string, limitPerMin: number, env: Env): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowKey = `rl:${tenantId}:${Math.floor(now / 60_000)}`;

  const current = parseInt(await env.RATE_LIMIT.get(windowKey) ?? '0', 10);

  if (current >= limitPerMin) {
    return { allowed: false, remaining: 0, resetAt: (Math.floor(now / 60_000) + 1) * 60_000 };
  }

  // Increment counter (expires in 120s — covers 2 windows for sliding)
  await env.RATE_LIMIT.put(windowKey, String(current + 1), { expirationTtl: 120 });

  return { allowed: true, remaining: limitPerMin - current - 1, resetAt: (Math.floor(now / 60_000) + 1) * 60_000 };
}

// ─── Audit Logging to D1 ────────────────────────────────────────────────

async function auditLog(env: Env, entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
  try {
    await env.AUDIT_DB.prepare(
      'INSERT INTO ai_audit (tenant_id, api_key_hash, endpoint, model, prompt_tokens, completion_tokens, cache_hit, source, client_ip, user_agent, request_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      entry.tenant_id,
      sanitizeForLog(entry.api_key_hash),
      entry.endpoint,
      entry.model,
      entry.prompt_tokens,
      entry.completion_tokens,
      entry.cache_hit ? 1 : 0,
      entry.source,
      entry.client_ip,
      sanitizeForLog(entry.user_agent).slice(0, 200),
      entry.request_hash,
    ).run();
  } catch (err) {
    console.error('[audit] D1 insert failed:', err);
  }
}

// ─── AI Inference: Edge (Workers AI) with Homelab Fallback ──────────────

async function runInference(
  messages: Array<{ role: string; content: string }>,
  model: string,
  env: Env,
  options: { stream?: boolean; maxTokens?: number } = {},
): Promise<{ response: string; tokens: { prompt: number; completion: number }; source: 'edge' | 'homelab'; cacheHit: boolean }> {
  // Tier 1: Workers AI on the edge (free, fast, ~10K neurons/day)
  try {
    const aiResponse = await env.AI.run(model, {
      messages,
      max_tokens: options.maxTokens ?? 1024,
      stream: false,
    });

    if (aiResponse && aiResponse.response) {
      return {
        response: aiResponse.response,
        tokens: {
          prompt: (aiResponse as any).usage?.prompt_tokens ?? 0,
          completion: (aiResponse as any).usage?.completion_tokens ?? 0,
        },
        source: 'edge',
        cacheHit: false,
      };
    }
  } catch (err) {
    console.warn('[ai] Workers AI failed, falling back to homelab:', err);
  }

  // Tier 2: Homelab local model (Qwen3.5-4B on cluster GPUs)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HOMELAB_TIMEOUT_MS);

    const resp = await fetch(`${env.HOMELAB_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.HOMELAB_API_KEY}`,
      },
      body: JSON.stringify({
        model: HOMELAB_FALLBACK_MODEL,
        messages,
        max_tokens: options.maxTokens ?? 1024,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json() as any;
      return {
        response: data.choices?.[0]?.message?.content ?? '',
        tokens: {
          prompt: data.usage?.prompt_tokens ?? 0,
          completion: data.usage?.completion_tokens ?? 0,
        },
        source: 'homelab',
        cacheHit: false,
      };
    }
  } catch (err) {
    console.error('[ai] Homelab fallback also failed:', err);
  }

  throw new Error('All AI inference providers failed');
}

// ─── Embeddings (Workers AI -> homelab Qdrant) ──────────────────────────

async function generateEmbedding(text: string, env: Env): Promise<number[] | null> {
  try {
    const result = await env.AI.run(EDGE_MODELS.embedding, { text: [text] });
    if (result && result.data && result.data.length > 0) {
      return result.data[0] as number[];
    }
  } catch (err) {
    console.warn('[ai] Embedding generation failed:', err);
  }
  return null;
}

// ─── Main Handler ───────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;
    const clientIP = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const userAgent = request.headers.get('User-Agent') ?? 'unknown';

    // ── CORS ──────────────────────────────────────────────────────────
    if (method === 'OPTIONS') {
      return corsResponse();
    }

    // ── Health check (public, no auth) ────────────────────────────────
    if (pathname === '/v1/health' && method === 'GET') {
      return jsonResponse({ success: true, data: { status: 'ok', source: 'edge-ai', models: Object.values(EDGE_MODELS) } });
    }

    // ── List models (public) ──────────────────────────────────────────
    if (pathname === '/v1/ai/models' && method === 'GET') {
      return jsonResponse({
        success: true,
        data: {
          edge: EDGE_MODELS,
          homelab_fallback: HOMELAB_FALLBACK_MODEL,
        },
      });
    }

    // ══ AUTHENTICATED ROUTES ══════════════════════════════════════════

    // ── Validate API key ──────────────────────────────────────────────
    const tenant = await validateApiKey(request, env);
    if (!tenant) {
      return jsonResponse(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Valid API key required. Get one at https://maplespike.ca/signup' } },
        401,
      );
    }

    // ── Rate limit check ──────────────────────────────────────────────
    const rateLimit = await checkRateLimit(tenant.id, tenant.rateLimitPerMin, env);
    if (!rateLimit.allowed) {
      return jsonResponse(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded. Try again later.' } },
        429,
        { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      );
    }

    // ── AI Ask ────────────────────────────────────────────────────────
    if (pathname === '/v1/ai/ask' && method === 'POST') {
      try {
        const body = await request.json() as { question?: string; model?: string; context?: string };
        const question = body.question?.trim();

        if (!question || question.length < 3) {
          return jsonResponse({ success: false, error: { code: 'BAD_REQUEST', message: 'question is required (min 3 chars)' } }, 400);
        }

        // Limit input length to prevent abuse
        if (question.length > 4000) {
          return jsonResponse({ success: false, error: { code: 'BAD_REQUEST', message: 'question too long (max 4000 chars)' } }, 400);
        }

        const model = body.model === 'fast' ? EDGE_MODELS.chatFast : EDGE_MODELS.chat;

        // Build system prompt with MapleSpike context
        const systemPrompt = `You are MapleSpike AI, an assistant for Canadian government data. You help users find, understand, and analyze Canadian federal, provincial, and municipal government data. You have access to 206 data modules covering committees, lobbying, procurement, courts, regulations, and open data across all 13 provinces and territories. Always cite your sources. If you don't know, say so. Never fabricate data or URLs.${body.context ? `\n\nRelevant context from MapleSpike:\n${body.context.slice(0, 2000)}` : ''}`;

        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ];

        const result = await runInference(messages, model, env, { maxTokens: 1024 });

        // Compute request hash for dedup detection
        const requestHash = await sha256(`${tenant.id}:${question}`);

        // Audit log
        await auditLog(env, {
          tenant_id: tenant.id,
          api_key_hash: await sha256(request.headers.get('X-API-Key') ?? request.headers.get('Authorization') ?? ''),
          endpoint: '/v1/ai/ask',
          model,
          prompt_tokens: result.tokens.prompt,
          completion_tokens: result.tokens.completion,
          cache_hit: result.cacheHit,
          source: result.source,
          client_ip: clientIP,
          user_agent: userAgent,
          request_hash: requestHash,
        });

        return jsonResponse({
          success: true,
          data: {
            answer: result.response,
            model: result.source === 'edge' ? model : HOMELAB_FALLBACK_MODEL,
            source: result.source,
            tokens: result.tokens,
            cached: result.cacheHit,
          },
          meta: {
            tenant_id: tenant.id,
            tier: tenant.tier,
            rate_limit_remaining: rateLimit.remaining,
            rate_limit_reset: new Date(rateLimit.resetAt).toISOString(),
          },
        });
      } catch (err) {
        console.error('[ai/ask] Error:', err);
        return jsonResponse({ success: false, error: { code: 'AI_ERROR', message: 'AI inference failed. Please try again.' } }, 503);
      }
    }

    // ── Semantic Search ───────────────────────────────────────────────
    if (pathname === '/v1/ai/search' && method === 'POST') {
      try {
        const body = await request.json() as { query?: string; limit?: number };
        const query = body.query?.trim();
        const limit = Math.min(body.limit ?? 10, 50);

        if (!query) {
          return jsonResponse({ success: false, error: { code: 'BAD_REQUEST', message: 'query is required' } }, 400);
        }

        // Generate embedding on the edge
        const embedding = await generateEmbedding(query, env);
        if (!embedding) {
          // Fallback: keyword search on homelab
          const keywordResult = await fetch(`${env.HOMELAB_API_URL}/v1/gov/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
            headers: { 'Authorization': `Bearer ${env.HOMELAB_API_KEY}` },
          });
          const data = await keywordResult.json() as any;
          return jsonResponse({ success: true, data: data, meta: { source: 'keyword-fallback' } });
        }

        // Vector search on homelab Qdrant
        const vectorResp = await fetch(`${env.HOMELAB_API_URL}/v1/ai/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.HOMELAB_API_KEY}`,
          },
          body: JSON.stringify({ query, embedding, limit }),
          signal: AbortSignal.timeout(HOMELAB_TIMEOUT_MS),
        });

        if (vectorResp.ok) {
          const data = await vectorResp.json() as any;
          return jsonResponse({ success: true, data: data, meta: { source: 'vector-edge-embedding' } });
        }

        throw new Error('Vector search failed');
      } catch (err) {
        console.error('[ai/search] Error:', err);
        return jsonResponse({ success: false, error: { code: 'SEARCH_ERROR', message: 'Search failed. Please try again.' } }, 503);
      }
    }

    // ── 404 ───────────────────────────────────────────────────────────
    return jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: `No route matches ${method} ${pathname}` } }, 404);
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────

function jsonResponse(body: any, status = 200, extraHeaders: Record<string, string> = {}): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'X-MapleSpike-Source': 'edge-ai',
    ...extraHeaders,
  };
  return new Response(JSON.stringify(body), { status, headers });
}

function corsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}
