import {
  guardForEnv,
  guardKvBinding,
  sharedMemoryKv,
  type CfD1Like,
  type CfKvLike,
} from '../../api-server/src/cf-data/quota-store.js';

/**
 * MapleSpike Edge Worker (Proxy)
 *
 * Routes Quill (data-layer MCP) requests between Cloudflare edge and homelab cluster.
 * Architecture (subdomain-based; `quill` was the previous alias — retired in ADR 0005 Phase C):
 *   maplespike.ca              -> Cloudflare Pages (brand SPA) — not handled here
 *   api.maplespike.ca/v1/*     -> Homelab API server (via tunnel, not this worker)
 *   mcp.maplespike.ca          -> Homelab Quill MCP server `quill-mcp:3001` (via tunnel, not this worker)
 *   data.maplespike.ca         -> Homelab portal serving the Quill surface (via tunnel) — Phase D alias: quill.maplespike.ca
 *
 * This worker handles cacheable GET proxying and IP-based rate limiting
 * for write operations. The Cloudflare Tunnel handles the actual k3s
 * routing — this worker is an optional caching/RL layer in front of it.
 * The AI endpoints (/v1/ai/*) are handled by ai-worker.ts, a separate
 * worker deployed on the api.maplespike.ca/v1/ai/* route.
 */

interface Env {
  HOMELAB_API: string;
  CACHE_TTL: string;
  RATE_LIMIT: CfKvLike;
  CACHE_DB: CfD1Like;
  /** Infra binding for `quota:<service>`. Missing means KV/D1 writes stay in-process. */
  QUOTA_FLAGS?: { get(key: string): Promise<string | null> };
  CF_QUOTA_FLAG_TTL_MS?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Health check
    if (pathname === '/health') {
      return Response.json({ status: 'ok', source: 'edge-worker' });
    }

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Cacheable GET requests (API health, billing plans, extraction tasks)
    if (method === 'GET' && isCacheable(pathname)) {
      const cache = caches.default;
      const cacheKey = new Request(url.toString());
      const cached = await cache.match(cacheKey);

      if (cached) {
        return cached;
      }

      const response = await proxyToHomelab(request, env, pathname, url.search);
      if (response.ok) {
        const cacheResponse = response.clone();
        await cache.put(cacheKey, cacheResponse);
      }

      return response;
    }

    // Rate limit for write operations. KV is used only when quota:kv is ok.
    // CACHE_DB is bound and has no writer here. A D1 write on it must call guardD1Binding.
    const clientIP = request.headers.get('CF-Connecting-IP');
    if (clientIP && ['POST', 'PUT', 'DELETE'].includes(method)) {
      const quota = guardForEnv(env);
      const rateKv = guardKvBinding(env.RATE_LIMIT, sharedMemoryKv(), quota);
      const rateLimitKey = `ip:${clientIP}`;
      const rateLimitData = await readRateCounter(await rateKv.get(rateLimitKey, { type: 'json' }));

      if (rateLimitData) {
        const { count, resetAt } = rateLimitData;
        const now = Date.now();

        if (now < resetAt && count > 1000) {
          return new Response('Rate limit exceeded. Try again later.', { status: 429 });
        }

        if (now >= resetAt) {
          await rateKv.put(rateLimitKey, JSON.stringify({ count: 1, resetAt: now + 3600000 }), {
            expirationTtl: 3600,
          });
        } else {
          await rateKv.put(rateLimitKey, JSON.stringify({ count: count + 1, resetAt }), {
            expirationTtl: 3600,
          });
        }
      } else {
        await rateKv.put(rateLimitKey, JSON.stringify({ count: 1, resetAt: Date.now() + 3600000 }), {
          expirationTtl: 3600,
        });
      }
    }

    // Route to homelab
    return proxyToHomelab(request, env, pathname, url.search);
  },
};

function readRateCounter(value: unknown): { count: number; resetAt: number } | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.count !== 'number' || typeof record.resetAt !== 'number') return null;
  return { count: record.count, resetAt: record.resetAt };
}

function isCacheable(path: string): boolean {
  return path === '/v1/billing/plans' ||
         path === '/v1/health' ||
         path === '/v1/openapi.json' ||
         path === '/v1/extraction/tasks';
}

async function proxyToHomelab(
  request: Request,
  env: Env,
  path: string,
  search: string,
): Promise<Response> {
  const base = env.HOMELAB_API || 'https://maplespike.lan';
  const homelabUrl = `${base}${path}${search}`;

  const response = await fetch(homelabUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  // Add edge-specific headers
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set('X-Edge-Worker', 'quill-edge');
  responseHeaders.set('X-Edge-Time', new Date().toISOString());
  responseHeaders.set('X-Homelab-Path', path);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}