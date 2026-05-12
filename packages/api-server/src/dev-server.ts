/**
 * CivInt Canada — Development Server
 *
 * Node.js HTTP server that mounts the same route handlers as the Worker.
 * Uses in-memory storage for local development.
 */

import * as http from 'node:http';
import { handleRequest } from './index.js';
import { MemoryStorage, MemoryCache } from './storage.js';

const PORT = parseInt(process.env.PORT || '8082', 10);
const AI_ENDPOINT = process.env.AI_ENDPOINT || 'http://127.0.0.1:8080/v1';
const AI_MODEL = process.env.AI_MODEL || 'qwen3.5-27b';

const env = {
  ENVIRONMENT: 'development',
  CIVINT_VERSION: '0.1.0',
  CIVINT_NAME: 'CivInt Canada (dev)',
  AI_ENDPOINT,
  AI_MODEL,
};

const db = new MemoryStorage();
const cache = new MemoryCache();

// Seed a dev tenant with known API key
// Usage: curl -H "Authorization: Bearer civint-dev-key" http://localhost:8081/v1/health
db.registerTenant(
  {
    id: 'dev-tenant',
    name: 'Dev User',
    tier: 'pro',
    isActive: true,
    journalismMode: false,
  },
  'c73d089e582ca8a90a5e3543a1c2fe6f89afc0f9c82319cea56a804048075799', // SHA-256 of "civint-dev-key"
  'dev-key-1',
);

const server = http.createServer(async (req, res) => {
  try {
    // Convert Node req to Web API Request
    const protocol = (req.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http';
    const host = req.headers.host || 'localhost';
    const url = `${protocol}://${host}${req.url || '/'}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    }

    // Read body for POST requests
    let body: string | null = null;
    if (req.method === 'POST' || req.method === 'PUT') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      body = Buffer.concat(chunks).toString('utf-8');
    }

    const request = new Request(url, {
      method: req.method,
      headers,
      body,
    });

    const response = await handleRequest(request, env, db, cache);

    // Write response back to Node HTTP
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    res.writeHead(response.status, responseHeaders);

    const responseBody = await response.text();
    res.end(responseBody);
  } catch (err) {
    console.error('[DevServer] Fatal:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } }));
  }
});

server.listen(PORT, () => {
  console.log(`\n  CivInt Canada API (dev)`);
  console.log(`  ${'─'.repeat(40)}`);
  console.log(`  Server:    http://localhost:${PORT}/v1`);
  console.log(`  Health:    http://localhost:${PORT}/v1/health`);
  console.log(`  Spec:      http://localhost:${PORT}/v1/openapi.json`);
  console.log(`  AI:        ${AI_ENDPOINT} (${AI_MODEL})`);
  console.log(`\n  Auth:      civint-dev-key`);
  console.log(`  Example:   curl -H "Authorization: Bearer civint-dev-key" http://localhost:${PORT}/v1/health`);
  console.log(`  ${'─'.repeat(40)}\n`);
});
