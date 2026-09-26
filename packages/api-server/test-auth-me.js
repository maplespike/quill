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

  console.log('Starting tests for /v1/auth/me...');

  // Test 1: No credentials -> 401 (since we removed the exemption for /v1/auth/me)
  {
    const res = await call('/v1/auth/me');
    if (res.status !== 401) {
      console.error(`FAIL: Expected 401 for no credentials, got ${res.status}`);
      process.exit(1);
    }
    const body = await json(res);
    if (body.success) {
      console.error(`FAIL: Expected error success false, got success true`);
      process.exit(1);
    }
    if (body.error.code !== 'UNAUTHORIZED') {
      console.error(`FAIL: Expected UNAUTHORIZED error code, got ${body.error.code}`);
      process.exit(1);
    }
    console.log('PASS: No credentials -> 401');
  }

  // Test 2: Valid API key -> tenant info (not anonymous)
  {
    // First, register a tenant to get an API key
    const registerRes = await call('/v1/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: 'test@example.com' }),
    });
    if (registerRes.status !== 200 && registerRes.status !== 201) {
      console.error(`FAIL: Registration failed with status ${registerRes.status}`);
      process.exit(1);
    }
    const registerBody = await json(registerRes);
    if (!registerBody.success) {
      console.error(`FAIL: Registration failed: ${JSON.stringify(registerBody.error)}`);
      process.exit(1);
    }
    const apiKey = registerBody.data.apiKey.key; // raw key
    const tenantId = registerBody.data.tenant.id;

    // Now call /v1/auth/me with that key
    const authRes = await call('/v1/auth/me', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (authRes.status !== 200) {
      console.error(`FAIL: Expected 200 for valid key, got ${authRes.status}`);
      process.exit(1);
    }
    const authBody = await json(authRes);
    if (!authBody.success) {
      console.error(`FAIL: Expected success, got ${JSON.stringify(authBody.error)}`);
      process.exit(1);
    }
    // The tenant should match the registered tenant, not anon
    if (authBody.data.tenant.id === 'anon') {
      console.error(`FAIL: Expected non-anon tenant, got anon`);
      process.exit(1);
    }
    if (authBody.data.tenant.id !== tenantId) {
      console.error(`FAIL: Expected tenant ${tenantId}, got ${authBody.data.tenant.id}`);
      process.exit(1);
    }
    if (authBody.data.tenant.name !== 'Test User') {
      console.error(`FAIL: Expected name 'Test User', got ${authBody.data.tenant.name}`);
      process.exit(1);
    }
    // The apiKeys array should contain at least one key (the one we just created)
    if (!Array.isArray(authBody.data.apiKeys) || authBody.data.apiKeys.length !== 1) {
      console.error(`FAIL: Expected one apiKey, got ${JSON.stringify(authBody.data.apiKeys)}`);
      process.exit(1);
    }
    const key = authBody.data.apiKeys[0];
    if (!key.id) {
      console.error(`FAIL: Expected key to have id`);
      process.exit(1);
    }
    if (key.name !== 'default') {
      console.error(`FAIL: Expected key name 'default', got ${key.name}`);
      process.exit(1);
    }
    if (!key.isActive) {
      console.error(`FAIL: Expected key to be active`);
      process.exit(1);
    }
    // The user object should match the tenant (since we have no GitHub user linked)
    if (!authBody.data.user) {
      console.error(`FAIL: Expected user object`);
      process.exit(1);
    }
    if (authBody.data.user.id !== tenantId) {
      console.error(`FAIL: Expected user id ${tenantId}, got ${authBody.data.user.id}`);
      process.exit(1);
    }
    if (authBody.data.user.name !== 'Test User') {
      console.error(`FAIL: Expected user name 'Test User', got ${authBody.data.user.name}`);
      process.exit(1);
    }
    console.log('PASS: Valid API key -> tenant info');
  }

  // Test 3: Invalid API key -> 401
  {
    const res = await call('/v1/auth/me', {
      headers: { Authorization: 'Bearer invalid_key' },
    });
    if (res.status !== 401) {
      console.error(`FAIL: Expected 401 for invalid key, got ${res.status}`);
      process.exit(1);
    }
    const body = await json(res);
    if (body.success) {
      console.error(`FAIL: Expected error success false, got success true`);
      process.exit(1);
    }
    if (body.error.code !== 'UNAUTHORIZED') {
      console.error(`FAIL: Expected UNAUTHORIZED error code, got ${body.error.code}`);
      process.exit(1);
    }
    console.log('PASS: Invalid API key -> 401');
  }

  // Test 4: OAuth login flow still reachable (exempt) -> /v1/auth/oauth/github should be exempt (no credentials) and return 302 (redirect)
  {
    const res = await call('/v1/auth/oauth/github');
    if (res.status !== 302) {
      console.error(`FAIL: Expected 302 for OAuth login, got ${res.status}`);
      process.exit(1);
    }
    // Check that it redirects to GitHub
    const location = res.headers.get('Location');
    if (!location || !location.startsWith('https://github.com/login/oauth/authorize')) {
      console.error(`FAIL: Expected redirect to GitHub, got ${location}`);
      process.exit(1);
    }
    console.log('PASS: OAuth login flow still exempt');
  }

  console.log('All tests passed!');
  process.exit(0);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});