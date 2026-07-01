/**
 * MapleSpike Edge Worker
 *
 * Routes requests between Cloudflare edge and homelab cluster.
 * Architecture:
 *   maplespike.ca/              -> Cloudflare Pages (brand SPA) — not handled here
 *   maplespike.ca/datafabric/*  -> Homelab k3s MapleSpike (portal + API + MCP)
 *   maplespike.ca/datafabric/v1/* -> Homelab API server
 *   maplespike.ca/datafabric/mcp  -> Homelab MCP server
 */

interface Env {
  HOMELAB_API: string;
  HOMELAB_PORTAL: string;
  CACHE_TTL: string;
  RATE_LIMIT: KVNamespace;
  CACHE_DB: D1Database;
}

const DATAFABRIC_PREFIX = '/datafabric';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Health check
    if (pathname === '/health') {
      return Response.json({ status: 'ok', source: 'edge-worker' });
    }

    // Only handle /datafabric/* routes — everything else falls through to Pages
    if (!pathname.startsWith(DATAFABRIC_PREFIX)) {
      // Let Cloudflare Pages handle the brand SPA
      return fetch(request);
    }

    // Strip /datafabric prefix to get the homelab path
    const homelabPath = pathname.slice(DATAFABRIC_PREFIX.length) || '/';

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

    // Cacheable GET requests (API health, billing plans)
    if (method === 'GET' && isCacheable(homelabPath)) {
      const cache = caches.default;
      const cacheKey = new Request(url.toString());
      const cached = await cache.match(cacheKey);

      if (cached) {
        return cached;
      }

      const response = await proxyToHomelab(request, env, homelabPath, url.search);
      if (response.ok) {
        const cacheResponse = response.clone();
        await cache.put(cacheKey, cacheResponse);
      }

      return response;
    }

    // Rate limit check for write operations (KV-based, free tier)
    const clientIP = request.headers.get('CF-Connecting-IP');
    if (clientIP && ['POST', 'PUT', 'DELETE'].includes(method)) {
      const rateLimitKey = `ip:${clientIP}`;
      const rateLimitData = await env.RATE_LIMIT.get(rateLimitKey, { type: 'json' });

      if (rateLimitData) {
        const { count, resetAt } = rateLimitData as { count: number; resetAt: number };
        const now = Date.now();

        if (now < resetAt && count > 1000) {
          return new Response('Rate limit exceeded. Try again later.', { status: 429 });
        }

        if (now >= resetAt) {
          await env.RATE_LIMIT.put(rateLimitKey, JSON.stringify({ count: 1, resetAt: now + 3600000 }), {
            expirationTtl: 3600,
          });
        } else {
          await env.RATE_LIMIT.put(rateLimitKey, JSON.stringify({ count: count + 1, resetAt }), {
            expirationTtl: 3600,
          });
        }
      } else {
        await env.RATE_LIMIT.put(rateLimitKey, JSON.stringify({ count: 1, resetAt: Date.now() + 3600000 }), {
          expirationTtl: 3600,
        });
      }
    }

    // Route to homelab
    return proxyToHomelab(request, env, homelabPath, url.search);
  },
};

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
  responseHeaders.set('X-Edge-Worker', 'maplespike-edge');
  responseHeaders.set('X-Edge-Time', new Date().toISOString());
  responseHeaders.set('X-Homelab-Path', path);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}