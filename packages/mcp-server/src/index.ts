import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { SessionManager } from './session.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const API_KEY = process.env.MAPLESPIKE_API_KEY ?? 'dev-key';

const sessionManager = new SessionManager();

console.error(`[maplespike-mcp] SSE server starting on port ${PORT}`);

interface SseClient {
  id: string;
  res: ServerResponse;
}

let clientIdCounter = 0;
const clients = new Map<string, SseClient>();

function sendSse(res: ServerResponse, event: string, data: unknown): void {
  const body = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  res.write(body);
}

function authenticate(req: IncomingMessage): boolean {
  if (API_KEY === 'dev-key' && process.env.NODE_ENV !== 'production') return true;
  const auth = req.headers.authorization ?? '';
  return auth === `Bearer ${API_KEY}` || auth === `Bearer ${Buffer.from(API_KEY).toString('base64')}`;
}

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;

  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', sessions: sessionManager.getSessionCount() }));
    return;
  }

  if (path === '/sse' && req.method === 'GET') {
    if (!authenticate(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const clientId = `client-${++clientIdCounter}`;
    const acceptLang = req.headers['accept-language'] || '';
    const locale = acceptLang.startsWith('fr') ? 'fr-CA' : 'en-CA';

    sessionManager.createSession(clientId, locale, true);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    sendSse(res, 'endpoint', { endpoint: `/messages?clientId=${clientId}` });

    clients.set(clientId, { id: clientId, res });

    console.error(`[maplespike-mcp] SSE client connected: ${clientId} (sessions: ${sessionManager.getSessionCount()})`);

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 30_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(clientId);
      sessionManager.removeSession(clientId);
      console.error(`[maplespike-mcp] SSE client disconnected: ${clientId} (sessions: ${sessionManager.getSessionCount()})`);
    });

    return;
  }

  if (path === '/messages' && req.method === 'POST') {
    const clientId = (url.searchParams.get('clientId') as string) ?? 'unknown';
    const client = clients.get(clientId);

    if (!client) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No SSE connection for this client ID' }));
      return;
    }

    const rateLimit = sessionManager.checkRateLimit(clientId);
    if (!rateLimit.allowed) {
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(rateLimit.resetTime),
      });
      res.end(JSON.stringify({ error: 'Rate limit exceeded', resetTime: rateLimit.resetTime }));
      return;
    }

    let body = '';
    req.on('data', (chunk: string) => { body += chunk; });
    req.on('end', () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        sendSse(client.res, 'error', { code: -32700, message: 'Parse error' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      const session = sessionManager.getSession(clientId);
      if (!session) {
        sendSse(client.res, 'error', { code: -32000, message: 'Session not found' });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }

      session.server.handleMessage(parsed, session.locale, (response) => {
        sendSse(client.res, 'message', response);
      }).catch((err: unknown) => console.error('[maplespike-mcp] Error handling message:', err));

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accepted: true }));
    });

    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', path }));
});

httpServer.listen(PORT, () => {
  console.log(`[maplespike-mcp] Hosted SSE server running on http://0.0.0.0:${PORT}`);
  console.log(`[maplespike-mcp] SSE endpoint: http://0.0.0.0:${PORT}/sse`);
  console.log(`[maplespike-mcp] Health check: http://0.0.0.0:${PORT}/health`);
});

process.on('SIGINT', () => {
  console.error('[maplespike-mcp] SIGINT received, closing SSE connections');
  for (const { res } of clients.values()) {
    res.end();
  }
  httpServer.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.error('[maplespike-mcp] SIGTERM received, shutting down');
  httpServer.close(() => process.exit(0));
});
