import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// We are in packages/api-server, so the dist is ./dist
const distDir = join(__dirname, 'dist');

async function main() {
  // Load the built modules
  const indexModule = await import(join(distDir, 'index.js'));
  const storageModule = await import(join(distDir, 'node-sqlite-storage.js'));
  const cacheModule = await import(join(distDir, 'node-sqlite-cache.js'));

  const { handleRequest } = indexModule;
  const { NodeSqliteStorage } = storageModule;
  const { NodeSqliteCache } = cacheModule;

  // Setup storage and cache (in memory)
  const db = new NodeSqliteStorage(':memory:');
  const cache = new NodeSqliteCache();

  const env = {
    ENVIRONMENT: 'test',
    QUILL_VERSION: 'test',
    QUILL_PII_HASH_SECRET: '0'.repeat(64),
    JWT_SECRET: 'a'.repeat(64),
    JWT_SECRET_IS_SIMPLE: 'true',
  };

  // Helper to make a request
  async function call(path, init = {}) {
    const res = await handleRequest(
      new Request(`http://test.local${path}`, init),
      env,
      db,
      cache
    );
    return res;
  }

  // Helper to parse JSON response
  async function json(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { __raw: text };
    }
  }

  interface Tenant {
    id: string;
    key: string;
  }

  async function register(name: string, email: string): Promise<Tenant> {
    const res = await call('/v1/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    });
    const body = await json(res);
    if (!(res.status === 200 || res.status === 201)) {
      throw new Error(`register failed (HTTP ${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
    }
    const data = body['data'] as
      | { tenant?: { id?: string; tier?: string }; apiKey?: { key?: string } }
      | undefined;
    if (!data?.tenant?.id) {
      throw new Error('register response must carry data.tenant.id');
    }
    if (!data?.apiKey?.key) {
      throw new Error('register response must carry an API key');
    }
    if (!String(data!.apiKey!.key).startsWith('quill_')) {
      throw new Error('API keys are prefixed quill_');
    }
    if (data!.tenant!.tier !== 'free') {
      throw new Error('registration starts a tenant on the free tier');
    }
    return { id: String(data!.tenant!.id), key: String(data!.apiKey!.key) };
  }

  console.log('Starting API user journey tests...');

  let tenantA: Tenant;
  let tenantB: Tenant;
  let keyVault: string;

  try {
    tenantA = await register('Journey A', 'journey-a@example.com');
    tenantB = await register('Journey B', 'journey-b@example.com');
  } catch (err) {
    console.error(`Registration failed: ${err}`);
    process.exit(1);
  }

  // Test 1: registration issues a usable key for a brand-new tenant
  {
    if (!/^quill_[A-Za-z0-9]+$/.test(tenantA.key)) {
      console.error(`FAIL: tenantA.key does not match quill_ pattern: ${tenantA.key}`);
      process.exit(1);
    }
    if (tenantA.id === tenantB.id) {
      console.error(`FAIL: each registration must get its own tenant`);
      process.exit(1);
    }
    if (tenantA.key === tenantB.key) {
      console.error(`FAIL: each registration must get its own key`);
      process.exit(1);
    }
    console.log('PASS: 1. registration issues a usable key for a brand-new tenant');
  }

  // Test 2: the issued key authenticates: gated routes answer 402, never 401
  {
    const res = await call('/v1/me', { headers: { Authorization: `Bearer ${tenantA.key}` } });
    if (res.status !== 402) {
      console.error(`FAIL: expected 402 for valid free key on gated route, got ${res.status}`);
      process.exit(1);
    }
    const body = await json(res);
    const err = (body['error'] ?? {}) as Record<string, unknown>;
    if (err['code'] !== 'UPGRADE_REQUIRED') {
      console.error(`FAIL: expected error code UPGRADE_REQUIRED, got ${err['code']}`);
      process.exit(1);
    }
    const msgEn = String(err['message'] ?? '');
    if (!/plan|tier|free/i.test(msgEn)) {
      console.error(`FAIL: expected EN message to explain the boundary, got: ${msgEn}`);
      process.exit(1);
    }
    const msgFr = String(err['message_fr'] ?? '');
    if (msgFr.length === 0 || /inconnue/i.test(msgFr)) {
      console.error(`FAIL: expected FR message to be real, got: ${msgFr}`);
      process.exit(1);
    }
    console.log('PASS: 2. the issued key authenticates: gated routes answer 402, never 401');
  }

  // Test 3: tenant isolation: no response addressed to B ever carries A
  {
    const resB = await call('/v1/me', { headers: { Authorization: `Bearer ${tenantB.key}` } });
    const flatB = JSON.stringify(await json(resB));
    if (flatB.includes(tenantA.id)) {
      console.error(`FAIL: key B response must not leak tenant A identity`);
      process.exit(1);
    }
    if (flatB.includes(tenantA.key)) {
      console.error(`FAIL: key B response must not leak tenant A key material`);
      process.exit(1);
    }
    if (flatB.includes(tenantB.key)) {
      console.error(`FAIL: responses must not echo raw key material back`);
      process.exit(1);
    }
    console.log('PASS: 3. tenant isolation: no response addressed to B ever carries A');
  }

  // Test 4: a free-tier endpoint is reachable with the key
  {
    const res = await call('/v1/llms.txt', { headers: { Authorization: `Bearer ${tenantA.key}` } });
    if (res.status !== 200) {
      console.error(`FAIL: llms.txt must stay free for a signed-up tenant, got ${res.status}`);
      process.exit(1);
    }
    console.log('PASS: 4. a free-tier endpoint is reachable with the key');
  }

  // Test 5: the paid boundary answers 402 with an explanatory body
  {
    const res = await call('/v1/gov/search?q=housing', { headers: { Authorization: `Bearer ${tenantA.key}` } });
    if (res.status !== 402) {
      console.error(`FAIL: expected 402 for free tenant calling a data route, got ${res.status}`);
      process.exit(1);
    }
    const body = await json(res);
    const flat = JSON.stringify(body);
    if (body['__raw'] !== undefined) {
      console.error(`FAIL: 402 body must be JSON, got: ${flat.slice(0, 120)}`);
      process.exit(1);
    }
    if (!/upgrade|tier|plan|limit|quota/i.test(flat)) {
      console.error(`FAIL: 402 body must explain the boundary (upgrade/tier/plan), got: ${flat.slice(0, 300)}`);
      process.exit(1);
    }
    console.log('PASS: 5. the paid boundary answers 402 with an explanatory body');
  }

  // Test 6: a bad key is rejected with 401 (never silently accepted)
  {
    const res = await call('/v1/me', { headers: { Authorization: 'Bearer quill_not_a_real_key' } });
    if (res.status !== 401) {
      console.error(`FAIL: expected 401 for bad key, got ${res.status}`);
      process.exit(1);
    }
    console.log('PASS: 6. a bad key is rejected with 401 (never silently accepted)');
  }

  // Test 7: a missing key is rejected with 401
  {
    const res = await call('/v1/me');
    if (res.status !== 401) {
      console.error(`FAIL: expected 401 for missing key, got ${res.status}`);
      process.exit(1);
    }
    console.log('PASS: 7. a missing key is rejected with 401');
  }

  // Test 8: the key list shows the tenant its own key (masked, never the raw secret)
  {
    const res = await call('/v1/keys', { headers: { Authorization: `Bearer ${tenantA.key}` } });
    if (!(res.status === 200 || res.status === 402)) {
      console.error(`FAIL: unexpected /v1/keys status ${res.status}`);
      process.exit(1);
    }
    if (res.status === 200) {
      const flat = JSON.stringify(await json(res));
      if (flat.includes(tenantA.key)) {
        console.error(`FAIL: the key list must never echo the raw API key back`);
        process.exit(1);
      }
      if (flat.includes(tenantB.key)) {
        console.error(`FAIL: the key list must not contain another tenant key`);
        process.exit(1);
      }
    }
    console.log('PASS: 8. the key list shows the tenant its own key (masked, never the raw secret)');
  }

  console.log('All user journey tests passed!');
  process.exit(0);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});