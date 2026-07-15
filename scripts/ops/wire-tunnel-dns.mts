#!/usr/bin/env -S npx tsx
//
// scripts/ops/wire-tunnel-dns.mts
//
// Wires Cloudflare DNS CNAMEs for *.maplespike.ca subdomains to the active
// Cloudflare Tunnel (maplespike-k8s, UUID 66d76492-036b-4177-8fac-8682e0eda37e).
//
//   • Reads the wrangler OAuth token from ~/.config/.wrangler/config/default.toml.
//   • Looks up the maplespike.ca zone via Cloudflare SDK (works because
//     wrangler OAuth has account:read + (you need to add) zone:read).
//   • Upserts a CNAME record per (subdomain, tunnel UUID) pair — creates if
//     missing, updates if present.
//
// Prerequisites (one-time):
//   • wrangler OAuth scopes must include zone:read + zone:dns:edit (otherwise
//     the listing or write call returns HTTP 403).
//   • Or fall back to the Cloudflare Dashboard DNS pages manually — see
//     DEPLOY-CHECKLIST.md Step 1d for the full fallback procedure.
//
// Usage:
//   TUNNEL=66d76492-036b-4177-8fac-8682e0eda37e \
//   npx tsx scripts/ops/wire-tunnel-dns.mts
//
// Override targets via SUBDOMAINS=quill,api,mcp,mapping  env var (comma-separated).
//
// ────────────────────────────────────────────────────────────────────────────
//
import { Cloudflare } from 'cloudflare';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tunnel = process.env.TUNNEL ?? '66d76492-036b-4177-8fac-8682e0eda37e';
const subdomains = (process.env.SUBDOMAINS ?? 'quill,api,mcp,data,datafabric')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const zoneName = process.env.ZONE ?? 'maplespike.ca';

(async () => {
  const cfgPath = path.join(os.homedir(), '.config/.wrangler/config/default.toml');
  if (!fs.existsSync(cfgPath)) {
    console.error(`❌ wrangler config not found at ${cfgPath} — run \`wrangler login\` first.`);
    process.exit(2);
  }
  const cfg = fs.readFileSync(cfgPath, 'utf8');
  const m = cfg.match(/oauth_token\s*=\s*["']([^"']+)["']/i);
  if (!m) {
    console.error('❌ oauth_token not found in wrangler config. Re-run `wrangler login`.');
    process.exit(2);
  }
  const oauthToken = m[1];
  console.log(`[wire-tunnel-dns] tunnel = ${tunnel}`);
  console.log(`[wire-tunnel-dns] zone   = ${zoneName}`);
  console.log(`[wire-tunnel-dns] hosts  = ${subdomains.join(', ')}`);

  const cf = new Cloudflare({ oauthToken, apiToken: undefined });

  // Account lookup — needs account:read (the wrangler OAuth token already has this).
  const accounts = await cf.accounts.list();
  const account = accounts.result[0];
  if (!account) {
    console.error('❌ Cloudflare account list returned 0 results — token is invalid or scoped wrong.');
    process.exit(3);
  }
  console.log(`[wire-tunnel-dns] account = ${account.name} (${account.id})`);

  // Zone lookup — needs zone:read (you may need to widen OAuth scopes if this 403s).
  const zones = await cf.zones.list({ name: zoneName });
  const zone = zones.result[0];
  if (!zone) {
    console.error(`❌ zone "${zoneName}" not found in this account. Confirm apex is on same Cloudflare account as Pages.`);
    process.exit(3);
  }
  console.log(`[wire-tunnel-dns] zone.id = ${zone.id}`);

  const target = `${tunnel}.cfargotunnel.com`;
  for (const sub of subdomains) {
    const name = `${sub}.${zoneName}`;
    try {
      const existing = await cf.dns.records.list({
        zone_id: zone.id,
        type: 'CNAME',
        name,
      });
      if (existing.result.length > 0) {
        const cur = existing.result[0];
        await cf.dns.records.update(cur.id, {
          zone_id: zone.id,
          type: 'CNAME',
          name: cur.name,
          content: target,
          proxied: true,
          comment: 'Wired to maplespike-k8s Cloudflare Tunnel via scripts/ops/wire-tunnel-dns.mts',
        });
        console.log(`✓ updated ${name} → ${target}`);
      } else {
        await cf.dns.records.create({
          zone_id: zone.id,
          type: 'CNAME',
          name,
          content: target,
          proxied: true,
          comment: 'Wired to maplespike-k8s Cloudflare Tunnel via scripts/ops/wire-tunnel-dns.mts',
        });
        console.log(`✓ created ${name} → ${target}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`✗ ${name}: ${msg}`);
    }
  }

  console.log('\nProvisioned CNAMEs. Wait ~60s for Cloudflare edge cert, then verify:');
  for (const sub of subdomains) {
    const url = `https://${sub}.${zoneName}/`;
    console.log(`  curl -sS -o /dev/null -w '${sub} → HTTP %{http_code}\\n' ${url}`);
  }
  if (subdomains.includes('api')) {
    console.log("  curl -sS https://api.maplespike.ca/v1/health | jq .");
  }
})();
