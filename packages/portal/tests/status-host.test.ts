/**
 * status.maplespike.ca serves the status page at /.
 * Other hosts keep the homepage at /.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';

const SERVER = join(__dirname, '..', 'server.py');

let dir: string;
let proc: ChildProcess | undefined;
let port = 0;

const STATUS_BODY = '<!doctype html><title>status</title>'
  + '<div id="freshness-panel"></div>'
  + '<div id="municipal-health-panel"></div>'
  + '<div id="municipal-coverage-panel"></div>';

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const found = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(found));
    });
  });
}

function get(path: string, host: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'GET',
      headers: { Host: host },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk as Buffer));
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'quill-portal-status-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>home</title>');
  writeFileSync(join(dir, 'status.html'), STATUS_BODY);
  port = await freePort();
  proc = spawn('python3', [SERVER], {
    env: { ...process.env, PORT: String(port), PORTAL_STATIC_DIR: dir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const deadline = Date.now() + 15_000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const res = await get('/health', '127.0.0.1');
      if (res.status === 200) {
        ready = true;
        break;
      }
    } catch {
      // process still binding
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw new Error('portal did not become ready');
}, 30_000);

afterAll(() => {
  proc?.kill('SIGKILL');
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('status host route', () => {
  test('GET / on status.maplespike.ca renders the health, coverage, and freshness panels', async () => {
    const res = await get('/', 'status.maplespike.ca');
    expect(res.status).toBe(200);
    expect(res.body).toContain('id="freshness-panel"');
    expect(res.body).toContain('id="municipal-health-panel"');
    expect(res.body).toContain('id="municipal-coverage-panel"');
    expect(res.body).not.toContain('<title>home</title>');
  });

  test('GET / on the portal host stays the homepage', async () => {
    const res = await get('/', 'quill.maplespike.ca');
    expect(res.status).toBe(200);
    expect(res.body).toContain('<title>home</title>');
    expect(res.body).not.toContain('municipal-health-panel');
  });

  test('GET /status on the portal host still serves the status page', async () => {
    const res = await get('/status', 'quill.maplespike.ca');
    expect(res.status).toBe(200);
    expect(res.body).toContain('id="freshness-panel"');
    expect(res.body).toContain('id="municipal-coverage-panel"');
  });
});
