#!/usr/bin/env -S npx tsx
//
// scripts/ops/wire-tunnel-dns.mts
//
// Wires Cloudflare DNS CNAMEs for *.maplespike.ca subdomains to the active
// Cloudflare Tunnel (maplespike-k8s, UUID 66d76492-036b-4177-8fac-8682e0eda37e).
//
//   • Reads ~/.config/.wrangler/config/default.toml for auth.
//   • Falls back through two auth sources in priority order:
//       1. `api_token = "..."`  — classic Desktop Token with Zone:DNS:Edit
//       2. `oauth_token = "..."` — set by `wrangler login`
//     If both are present, the api_token wins (it's explicitly scoped; the
//     OAuth token usually has only account:read/user:read/workers:write and
//     will 403 on any /zones call).
//   • Calls Cloudflare REST directly via Node's native fetch() — no `cloudflare`
//     SDK because the version in this monorepo predates `oauthToken` in its
//     auth union (only recognizes apiEmail/apiKey/apiToken/userServiceKey).
//   • Upserts a CNAME per (subdomain, tunnel UUID) pair.
//
// Exit codes:
//   2 — wrangler config missing or has neither api_token nor oauth_token
//   3 — auth call (accounts.list or zones.list) failed for a non-scope reason
//   4 — auth worked, but the zone is unreachable due to token scopes (403) or
//       token rejected (401). Prints an actionable 401-vs-403 message.
//   99 — unhandled promise rejection (network failure, TLS error, etc.)
//   130 — SIGINT (Ctrl-C); handler installed at module top
//   0 — script ran; per-record summary is on stdout (created/updated/unchanged/failed).
//
// Usage:
//   TUNNEL=66d76492-036b-4177-8fac-8682e0eda37e \
//     npx tsx scripts/ops/wire-tunnel-dns.mts
//   SUBDOMAINS=quill,api,mcp,data,mosaic  npx tsx scripts/ops/wire-tunnel-dns.mts
//
// DRY_RUN behaviour:
//   DRY_RUN=1  —  Same auth probes + per-record list as a normal run (needed
//                 to know whether to "would create" vs "would update"). Only
//                 the per-record PUT/POST is suppressed.
//   DRY_RUN=2  —  "No API calls at all" mode. Skips even auth probes. Prints
//                 "would create N CNAMEs" with no zone lookup. Use only when
//                 you already KNOW the zone_id and want a pure smoke test.
//
// Single-file typecheck (requires --ignoreConfig: tsc refuses to load the
// repo tsconfig when an explicit file is given on the command line, TS5112):
//   npx tsc --noEmit --ignoreConfig --types node --strict --target ES2022 \
//     --module ESNext --moduleResolution bundler --skipLibCheck \
//     --allowImportingTsExtensions scripts/ops/wire-tunnel-dns.mts
//   Any other value (e.g. 99) silently falls through to a real write.
//
// Prerequisites for a non-dry run:
//   • The chosen token must have zone:read AND zone:dns:edit for the
//     `maplespike.ca` zone. Otherwise script exits 4 with three unblock
//     paths. See DEPLOY-CHECKLIST.md §Step 1d for context.
//
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CF_API = 'https://api.cloudflare.com/client/v4';
const tunnel = process.env.TUNNEL ?? '66d76492-036b-4177-8fac-8682e0eda37e';
if (process.env.TUNNEL === undefined) {
  console.warn(`⚠️  TUNNEL env var not set — using hardcoded default "${tunnel}".`);
  console.warn(`   Verify this is the active tunnel: \`wrangler tunnel info maplespike-k8s\`.`);
}
const subdomains = (process.env.SUBDOMAINS ?? 'quill,api,mcp,data')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const zoneName = process.env.ZONE ?? 'maplespike.ca';
// Strict string-equality parsing (not Number() + as cast) so DRY_RUN=99
// doesn't trick TypeScript. If DRY_RUN is set to something other than
// '' / '0' / '1' / '2', warn loudly and fall through to a real write —
// we don't silently coerce garbage because operators expect DRY_RUN to
// mean "no writes" and silently getting a real write here is a footgun.
const _rawDry = process.env.DRY_RUN;
const dryRunLevel: 0 | 1 | 2 =
  _rawDry === '1' ? 1 :
  _rawDry === '2' ? 2 : 0;
if (_rawDry !== undefined && _rawDry !== '' && _rawDry !== '0' && _rawDry !== '1' && _rawDry !== '2') {
  console.error(`⚠️  DRY_RUN=${JSON.stringify(_rawDry)} is unrecognized; treating as 0 (= will write). Use DRY_RUN=1 to dry-run with auth probes, DRY_RUN=2 for no-API-call smoke test.`);
}

// Conventional Ctrl-C handler — exit 130 instead of stack-tracing
// through the unhandled-rejection handler on fetch() interruption.
process.on('SIGINT', () => {
  console.error('\n⏹ interrupted');
  process.exit(130);
});

// ── Cloudflare REST response type — discriminated union. ────────────────────
// Each request returns either { ok: true; result: T } OR { ok: false; errors }.
// This lets TS narrow the result type at every call site (no `as` casts).

type CfOk<T> = { ok: true; result: T; status: number };
type CfErr = { ok: false; errors: { code: number; message: string }[]; status: number };
type CfResponse<T> = CfOk<T> | CfErr;

interface AccountSummary { id: string; name: string }
interface ZoneSummary { id: string; name: string }
interface DnsRecordSummary { id: string; name: string; content: string; proxied: boolean }

// ── Helpers (module-scope so hoisting is a non-issue at the call site). ─────

function readToken(contents: string, key: 'oauth_token' | 'api_token'): string | undefined {
  // ^ + m flag → match the start of any line; [^"'] excludes both quote
  // styles, so a value like "abc" or 'abc' both work.
  const re = new RegExp(`^${key}\\s*=\\s*["']([^"']+)["']`, 'im');
  return contents.match(re)?.[1];
}

function fail(msg: string, code = 1): never {
  console.error(`❌ ${msg}`);
  process.exit(code);
}

async function cfFetch<T>(
  authToken: string,
  method: string,
  urlPath: string,
  body?: unknown,
): Promise<CfResponse<T>> {
  const res = await fetch(`${CF_API}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  // CF REST always returns JSON, but guard against the unexpected.
  const raw = (await res.json().catch(() => ({}))) as { success?: boolean; result?: T; errors?: { code: number; message: string }[] };
  const ok = res.ok && typeof raw === 'object' && raw !== null && 'success' in raw && raw.success === true;
  if (ok) return { ok: true, status: res.status, result: raw.result as T };
  return { ok: false, status: res.status, errors: raw.errors ?? [{ code: 0, message: 'unknown error (no JSON body)' }] };
}

// Inline the scope-failure print at every call site rather than via a
// type-predicate helper. The predicate was causing TS to lose narrowing
// across the nested if/printScopeFailure boundary (the post-rewrite tsc
// errors at lines ~195/207). An inline check on `resp.status` keeps the
// CfErr narrowing tight without any cross-block predicate crossing.

function printScopeFailure(status: number, errors: { code: number; message: string }[], cfgPath: string): never {
  console.error('');
  console.error('──────── AUTH FAILURE ────────');
  console.error(`HTTP ${status} — ${errors.map((e) => `${e.code}: ${e.message}`).join('  ·  ')}`);
  console.error('');

  // 401 = token is *rejected* (expired/revoked/wrong format) — re-auth fixes it.
  // 403 = token is *valid* but doesn't have enough zone scopes — widening or a
  //       scoped Desktop Token is the fix.
  if (status === 401) {
    console.error('The Cloudflare API REJECTED the token outright. The token itself');
    console.error('is malformed, expired, or revoked — not a missing-scope problem.');
    console.error('');
    console.error('Pick one:');
    console.error('  • wrangler OAuth → re-run `wrangler logout && wrangler login`');
    console.error(`  • Classic api_token → rotate via https://dash.cloudflare.com/profile/api-tokens and paste into ${cfgPath}`);
    process.exit(4);
  }

  // 403 path
  console.error('The token validates against the account but cannot read the');
  console.error(`"${zoneName}" zone. Most likely this is the wrangler OAuth token, which`);
  console.error('per ROADMAP Known Drift normally has ONLY account:read + user:read +');
  console.error('workers:write — zone:read + zone:dns:edit are missing.');
  console.error('');
  console.error('Pick one of the THREE unblock paths below and re-run:');
  console.error('');
  console.error('(1) DASHBOARD MANUAL (4 min, no token work) — recommended for one-off:');
  console.error('    https://dash.cloudflare.com/?to=/:account/maplespike.ca/dns/records');
  console.error('    Add each CNAME:');
  for (const sub of subdomains) {
    console.error(`      Type "CNAME"  Name "${sub}"  Target "${tunnel}.cfargotunnel.com"  Proxy: Proxied`);
  }
  console.error('');
  console.error('(2) WIDEN THE WRANGLER OAUTH SCOPE (5 min, persists for future runs) —');
  console.error('    Profile → API Tokens → Edit Wrangler token → ADD Zone:Read + Zone:DNS:Edit.');
  console.error('    Then re-run this script.');
  console.error('');
  console.error('(3) SCOPED DESKTOP TOKEN (recommended for scripts) —');
  console.error('    https://dash.cloudflare.com/profile/api-tokens → Create Token →');
  console.error('    Template: "Edit zone DNS" → Zone Resources → Include → Specific zone → maplespike.ca');
  console.error(`    Copy the token into ${cfgPath} as \`api_token = "<token>"\``);
  console.error('    Then re-run this script. The script prefers api_token over oauth_token.');
  console.error('');
  process.exit(4);
}

function formatErrors(errors: { code: number; message: string }[]): string {
  return errors.map((e) => `${e.code}: ${e.message}`).join('  ·  ');
}

// ── Main flow ──────────────────────────────────────────────────────────────

const main = async (): Promise<void> => {
  const cfgPath = path.join(os.homedir(), '.config/.wrangler/config/default.toml');
  if (!fs.existsSync(cfgPath)) {
    fail(`wrangler config not found at ${cfgPath} — run \`wrangler login\` first.`, 2);
  }
  const cfg = fs.readFileSync(cfgPath, 'utf8');
  const apiToken = readToken(cfg, 'api_token');
  const oauthToken = readToken(cfg, 'oauth_token');
  const authToken = apiToken ?? oauthToken;
  if (authToken === undefined) {
    fail('no api_token or oauth_token in wrangler config. Re-run `wrangler login` or populate api_token.', 2);
  }
  const authKind = apiToken ? 'api_token (classic Desktop Token)' : 'oauth_token (wrangler OAuth)';

  console.log(`[wire-tunnel-dns] tunnel         = ${tunnel}`);
  console.log(`[wire-tunnel-dns] zone           = ${zoneName}`);
  console.log(`[wire-tunnel-dns] hosts          = ${subdomains.join(', ')}`);
  console.log(`[wire-tunnel-dns] auth           = ${authKind}`);
  console.log(`[wire-tunnel-dns] DRY_RUN_LEVEL  = ${dryRunLevel}  (0=write, 1=skip writes, 2=skip all API calls)`);
  console.log('');

  if (dryRunLevel === 2) {
    // Pure smoke — no auth probes, no zone lookup. Operator already knows.
    for (const sub of subdomains) {
      console.log(`  would create ${sub}.${zoneName} → ${tunnel}.cfargotunnel.com`);
    }
    console.log('');
    console.log('DRY_RUN=2 — no API calls made; assume zone_id and target are correct.');
    return;
  }

  // ── Account lookup (probes token validity) ──────────────────────────────
  const accResp = await cfFetch<AccountSummary[]>(authToken, 'GET', '/accounts?per_page=1');
  if (!accResp.ok) {
    if (accResp.status === 401 || accResp.status === 403) {
      printScopeFailure(accResp.status, accResp.errors, cfgPath);
    }
    fail(`/accounts call failed: HTTP ${accResp.status} ${formatErrors(accResp.errors)}`, 3);
  }
  const account = accResp.result[0];
  if (!account) fail('Cloudflare /accounts returned 0 results — token rejected.', 3);
  console.log(`[wire-tunnel-dns] account = ${account.name} (${account.id})`);

  // ── Zone lookup ──────────────────────────────────────────────────────────
  const zoneResp = await cfFetch<ZoneSummary[]>(authToken, 'GET', `/zones?name=${encodeURIComponent(zoneName)}`);
  if (!zoneResp.ok) {
    if (zoneResp.status === 401 || zoneResp.status === 403) {
      printScopeFailure(zoneResp.status, zoneResp.errors, cfgPath);
    }
    fail(`/zones call failed: HTTP ${zoneResp.status} ${formatErrors(zoneResp.errors)}`, 3);
  }
  const zone = zoneResp.result[0];
  if (!zone) fail(`zone "${zoneName}" not found in ${account.name}. Confirm apex is on same Cloudflare account.`, 3);
  console.log(`[wire-tunnel-dns] zone.id = ${zone.id}`);
  console.log('');

  // ── Upsert CNAMEs ────────────────────────────────────────────────────────
  const target = `${tunnel}.cfargotunnel.com`;
  // Cloudflare canonicalizes CNAME targets with a trailing dot (FQDN form); the
  // target we build here has none. Normalize both sides so records added via the
  // Dashboard (which CF stores with the trailing dot) are recognized as already
  // correct instead of being rewritten on every run (#785).
  const norm = (s: string) => (s.endsWith('.') ? s.slice(0, -1) : s);
  let created = 0, updated = 0, unchanged = 0, failed = 0;
  for (const sub of subdomains) {
    const name = `${sub}.${zoneName}`;
    const listResp = await cfFetch<DnsRecordSummary[]>(
      authToken,
      'GET',
      `/zones/${zone.id}/dns_records?type=CNAME&name=${encodeURIComponent(name)}`,
    );
    if (!listResp.ok) {
      console.error(`✗ ${name}: list failed (HTTP ${listResp.status}) ${formatErrors(listResp.errors)}`);
      failed++;
      continue;
    }
    const existing = listResp.result[0];
    // No-op short-circuit: if a CNAME already exists at this name AND it already
    // points at the right target AND it's already proxied, don't write. The CF
    // DNS write rate-limit is ~1200/5min on free tier; this keeps CI re-runs
    // (and the success-summary) from thrashing on records that are already correct.
    if (existing && norm(existing.content) === norm(target) && existing.proxied === true) {
      console.log(`✓ unchanged ${name} → ${target}`);
      unchanged++;
      continue;
    }
    const payload = {
      type: 'CNAME',
      name,
      content: target,
      proxied: true,
      comment: 'Wired to maplespike-k8s Cloudflare Tunnel via scripts/ops/wire-tunnel-dns.mts',
    };
    if (dryRunLevel === 1) {
      if (existing && norm(existing.content) === norm(target) && existing.proxied === true) {
        console.log(`  would leave unchanged ${name} → ${target}`);
        unchanged++; // keep the dry-run summary truthful (#784)
      } else {
        console.log(`  would ${existing ? 'update' : 'create'} ${name} → ${target}`);
      }
      continue;
    }
    const writeResp = existing
      ? await cfFetch<DnsRecordSummary>(authToken, 'PUT', `/zones/${zone.id}/dns_records/${existing.id}`, payload)
      : await cfFetch<DnsRecordSummary>(authToken, 'POST', `/zones/${zone.id}/dns_records`, payload);
    if (writeResp.ok) {
      console.log(`✓ ${writeResp.status === 200 ? 'updated' : 'created'} ${name} → ${target}`);
      if (existing) updated++; else created++;
    } else {
      console.error(`✗ ${name}: write failed (HTTP ${writeResp.status}) ${formatErrors(writeResp.errors)}`);
      failed++;
    }
  }

  console.log('');
  console.log(`[wire-tunnel-dns] summary: created=${created} updated=${updated} unchanged=${unchanged} failed=${failed}`);
  console.log('');
  console.log(`Provisioned CNAMEs at zone "${zoneName}" pointing at ${target}.`);
  console.log('Wait ~60s for Cloudflare edge cert, then verify:');
  for (const sub of subdomains) {
    console.log(`  curl -sS -o /dev/null -w '${sub} → HTTP %{http_code}\\n' https://${sub}.${zoneName}/`);
  }
  if (subdomains.includes('api')) {
    console.log('  curl -sS https://api.maplespike.ca/v1/health | jq .');
  }
  if (!apiToken && oauthToken) {
    console.log('');
    console.log('NOTE: If DNS writes succeeded with the wrangler OAuth, the token is');
    console.log('scoped wider than ROADMAP Known Drift claims (account:read + user:read');
    console.log('+ workers:write → ALSO has zone:read + zone:dns:edit). Update ROADMAP.');
  }
};

main().catch((e: unknown) => {
  console.error(`❌ unhandled error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(99);
});
