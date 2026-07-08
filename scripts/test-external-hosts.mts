#!/usr/bin/env tsx
/**
 * External-host reachability pinger for Quill docs.
 *
 * Documents reference a set of external HTTPS hosts (GitHub, npm, Helius,
 * Cloudflare, etc.). This walker hits each one with a 10-second HEAD
 * timeout and asserts the response is in the expected allowlist.
 *
 * Allowlist handles three classes of expected outcomes:
 *   - Normal hosts: must return 2xx/3xx
 *   - Anti-bot hosts: 200/301/302/403 all OK (crates.io, openai.com)
 *   - Known doc typos / unserved DNS: return code 0 (silent pass with warning)
 *
 * Runs as `tsx --test` so `pnpm run test:external` keeps the docs honest.
 * Disabled automatically when SKIP_NETWORK_TESTS=1 (air-gapped CI).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const SKIP = process.env.SKIP_NETWORK_TESTS === '1';

interface HostCheck {
  host: string;
  /** Allowed response status codes — empty array allows anything 100-399 */
  allow: number[];
  /** When true, fetch errors (DNS, TLS, network) are treated as 0-status and ignored */
  allowNetworkError?: boolean;
  note: string;
}

const HOSTS: HostCheck[] = [
  // ── Core doc infrastructure ──
  { host: 'github.com', allow: [200, 301, 302], note: 'GitHub web root' },
  { host: 'raw.githubusercontent.com', allow: [200, 301], note: 'Used by docs to link raw READMEs' },
  { host: 'registry.npmjs.org', allow: [200, 301], note: 'npm package metadata' },
  { host: 'pkg.pr.new', allow: [200, 301, 302], note: 'pkg.pr.new CI builds' },

  // ── Anti-bot hosts — must accept 403 ──
  { host: 'crates.io', allow: [200, 301, 302, 403], note: 'anti-bot — 403 expected from anonymous curl' },
  { host: 'openai.com', allow: [200, 301, 302, 403], note: 'anti-bot — 403 expected' },

  // ── x402 / Solana payment stack ──
  { host: 'docs.anthropic.com', allow: [200, 301, 302], note: 'Anthropic API docs' },
  { host: 'helius.dev', allow: [200, 301, 302], note: 'Solana RPC provider' },
  { host: 'solana.com', allow: [200, 301, 302], note: 'Solana protocol site' },
  { host: 'mcpay.dev', allow: [200, 301, 302], note: 'MCPay proxy for x402 devnet' },

  // ── Cloudflare deployment targets ──
  { host: 'workers.cloudflare.com', allow: [200, 301, 302], note: 'Workers examples' },
  { host: 'pages.cloudflare.com', allow: [200, 301, 302], note: 'Pages docs' },

  // ── Community / projects ──
  { host: 'discord.gg', allow: [200, 301, 302, 307], note: 'Community link' },
  { host: 'reverb256.ca', allow: [200, 301, 302], note: 'MapleSpike parent domain' },

  // ── Known-broken / doc typos — allowed to fail (#752 tracks the fix) ──
  { host: 'mcpay.com', allow: [0], allowNetworkError: true, note: 'Known doc typo — real service is mcpay.dev' },
  { host: 'astral-key.ca', allow: [0], allowNetworkError: true, note: 'NXDOMAIN — DNS pending (sister project)' },
];

async function ping(host: HostCheck): Promise<{ ok: boolean; status: number; err?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`https://${host.host}/`, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });
    return { ok: host.allow.includes(res.status) || (host.allow.length === 0 && res.status >= 100 && res.status < 400), status: res.status };
  } catch (err) {
    if (host.allowNetworkError) {
      return { ok: true, status: 0, err: (err as Error).message };
    }
    return { ok: false, status: 0, err: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

test(`external-hosts: ${HOSTS.length} documented hosts reachable (or allowlisted)`, { skip: SKIP && 'SKIP_NETWORK_TESTS=1' }, async () => {
  const results: { host: string; status: number; ok: boolean; note: string; err?: string }[] = [];
  // Run in parallel — total wall time is bounded by the slowest host (~10s)
  await Promise.all(HOSTS.map(async (h) => {
    const r = await ping(h);
    results.push({ host: h.host, status: r.status, ok: r.ok, note: h.note, err: r.err });
  }));

  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) {
    const summary = results.map((r) => `${r.status || '—'}  ${r.host}`).join('\n  ');
    assert.ok(true, `All ${results.length} hosts reachable:\n  ${summary}`);
    return;
  }

  const detail = failed
    .map((r) => `  ${r.status || '—'}  ${r.host}${r.err ? `  (${r.err.slice(0, 60)})` : ''} — ${r.note}`)
    .join('\n');
  assert.fail(
    `${failed.length}/${results.length} external host(s) unreachable:\n${detail}`,
  );
});
