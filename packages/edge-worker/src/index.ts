/**
 * MapleSpike Edge Worker
 *
 * Routes requests between Cloudflare edge and homelab cluster.
 * Serves cached GET requests from edge, routes heavy compute to homelab.
 */

interface Env {
  HOMELAB_API: string;
  CACHE_TTL: string;
  RATE_LIMIT: KVNamespace;
  CACHE_DB: D1Database;
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

    // Static pages (serve from Cloudflare Pages when deployed)
    if (method === 'GET' && (pathname === '/' || pathname === '/docs/')) {
      // TODO: Point to Cloudflare Pages once deployed
      return Response.json({ message: 'Portal will be served from Cloudflare Pages' });
    }

    // Cacheable GET requests
    if (method === 'GET' && CACHEABLE_PATHS.has(pathname)) {
      const cache = caches.default;
      const cacheKey = new Request(request.url);
      const cached = await cache.match(cacheKey);

      if (cached) {
        return cached;
      }

      const response = await fetch(`${env.HOMELAB_API}${pathname}${url.search}`);
      if (response.ok) {
        const cacheResponse = response.clone();
        await cache.put(cacheKey, cacheResponse);
      }

      return response;
    }

    // Rate limit check (KV-based, free tier)
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

    // Route all other requests to homelab
    return routeToHomelab(request, env);
  },
};

// Cacheable GET paths
const CACHEABLE_PATHS = new Set([
  '/v1/billing/plans',
  '/v1/health',
  '/v1/openapi.json',
]);

async function routeToHomelab(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const homelabUrl = `${env.HOMELAB_API}${url.pathname}${url.search}`;

  const response = await fetch(homelabUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  // Add edge-specific headers
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set('X-Edge-Worker', 'maplespike-edge');
  responseHeaders.set('X-Edge-Time', new Date().toISOString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}