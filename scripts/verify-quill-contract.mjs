// Verify Quill API/MCP contract: tool count == 184, uniform envelope, redirects.
// Run: node scripts/verify-quill-contract.mjs
import process from 'node:process';

const KEY = process.env.QUILL_API_KEY || process.env.MCP_API_KEY;
const API = 'https://api.maplespike.ca';
const MCP = 'https://mcp.maplespike.ca/mcp';

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

// 1. Envelope consistency on free REST endpoints
const endpoints = ['/v1/health', '/v1/onboarding', '/v1/gov/releases?limit=1'];
for (const ep of endpoints) {
  const res = await fetch(`${API}${ep}`, { headers: { 'x-api-key': KEY } });
  const d = await res.json();
  const keys = Object.keys(d).sort().join(',');
  const expected = 'citation,data,error,meta,quality,success,text';
  check(`envelope ${ep}`, keys === expected, `got ${keys}`);
}

// 2. MCP tool count
const init = await fetch(MCP, { method: 'POST', headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'verify', version: '1' } } }) });
await init.json();
const list = await fetch(MCP, { method: 'POST', headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) });
const ld = await list.json();
check('MCP tool count == 184', ld.result?.tools?.length === 184, `got ${ld.result?.tools?.length}`);

// 3. Redirects
for (const [from, to] of [['/health', '/v1/health'], ['/usage', '/v1/usage']]) {
  const r = await fetch(`${API}${from}`, { redirect: 'manual' });
  check(`redirect ${from} -> ${to}`, r.status === 308 && (r.headers.get('location') || '').endsWith(to));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);