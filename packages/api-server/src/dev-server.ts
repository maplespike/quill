/**
 * MapleSpike Canada — Development Server
 *
 * Node.js HTTP server that mounts the same route handlers as the Worker.
 * Supports in-memory (default) and SQLite storage backends.
 *
 * Usage:
 *   CIVINT_STORAGE=memory  node dist/dev-server.js   # in-memory (default)
 *   CIVINT_STORAGE=sqlite  node dist/dev-server.js   # SQLite persistence
 *   CIVINT_DB_PATH=/tmp/my.db node dist/dev-server.js # custom SQLite path
 */

import * as http from 'node:http';
import { handleRequest } from './index.js';
import { MemoryStorage, MemoryCache } from './storage.js';
import { SqliteStorage, SqliteStorageCache } from './sqlite-storage.js';
import type { MapleSpikeStorage, MapleSpikeCache } from './types.js';

const PORT = parseInt(process.env.PORT || '8081', 10);
const AI_ENDPOINT = process.env.AI_ENDPOINT || 'http://127.0.0.1:8080/v1';
const AI_MODEL = process.env.AI_MODEL || 'qwen3.5-27b';
const CIVINT_STORAGE = (process.env.CIVINT_STORAGE || 'memory').toLowerCase();
const CIVINT_DB_PATH = process.env.CIVINT_DB_PATH || './maplespike.db';

const env = {
  ENVIRONMENT: 'development',
  CIVINT_VERSION: '0.1.0',
  CIVINT_NAME: 'MapleSpike Canada (dev)',
  AI_ENDPOINT,
  AI_MODEL,
};

let db: MapleSpikeStorage;
let cache: MapleSpikeCache;

if (CIVINT_STORAGE === 'sqlite') {
  console.log(`[Storage] Using SQLite backend: ${CIVINT_DB_PATH}`);
  db = new SqliteStorage(CIVINT_DB_PATH);
  cache = new SqliteStorageCache();
} else {
  console.log('[Storage] Using in-memory backend');

  const memDb = new MemoryStorage();
  cache = new MemoryCache();

  // Seed a dev tenant with known API key
  // Usage: curl -H "Authorization: Bearer maplespike-dev-key" http://localhost:8081/v1/health
  memDb.registerTenant(
    {
      id: 'dev-tenant',
      name: 'Dev User',
      tier: 'pro',
      isActive: true,
      journalismMode: false,
    },
    'c73d089e582ca8a90a5e3543a1c2fe6f89afc0f9c82319cea56a804048075799', // SHA-256 of "maplespike-dev-key"
    'dev-key-1',
  );

  db = memDb;
}

function verifyStorageHealth(): boolean {
  try {
    if (db instanceof SqliteStorage) {
      const result = (db as SqliteStorage).getTenant('fg-internal');
      return !!result;
    }
    return true; // MemoryStorage is always healthy
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const protocol = (req.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http';
    const host = req.headers.host || 'localhost';
    const url = `${protocol}://${host}${req.url || '/'}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    }

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

if (!verifyStorageHealth()) {
  console.error('[Storage] Health check failed — aborting startup');
  process.exit(1);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  MapleSpike Canada API (dev)`);
  console.log(`  ${'─'.repeat(40)}`);
  console.log(`  Server:    http://0.0.0.0:${PORT}/v1`);
  console.log(`  Health:    http://localhost:${PORT}/v1/health`);
  console.log(`  Spec:      http://localhost:${PORT}/v1/openapi.json`);
  console.log(`  Storage:   ${CIVINT_STORAGE}`);
  if (CIVINT_STORAGE === 'sqlite') {
    console.log(`  DB Path:   ${CIVINT_DB_PATH}`);
  }
  console.log(`  AI:        ${AI_ENDPOINT} (${AI_MODEL})`);
  console.log(`\n  Auth:      maplespike-dev-key`);
  console.log(`  Example:   curl -H "Authorization: Bearer maplespike-dev-key" http://localhost:${PORT}/v1/health`);
  console.log(`  Register:  curl -X POST http://localhost:${PORT}/v1/register -H "Content-Type: application/json" -d '{"name":"My Org","email":"user@example.com"}'`);
  console.log(`  ${'─'.repeat(40)}\n`);
});
