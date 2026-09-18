#!/usr/bin/env node
/**
 * Copy the generated discovery assets from portal/public into the built site
 * directory (default: packages/portal/dist).
 *
 * Astro normally copies public/ into dist, but the `.well-known` directory is
 * dot-prefixed and copy behaviour can differ across tooling versions. This
 * post-build step makes the guarantee explicit: the MCP server cards and the
 * agent discovery files always land in the served output, and a local preview
 * never serves a stale agent surface.
 *
 * Idempotent. Run: node scripts/sync-discovery.mjs [distDir]
 */

import { cpSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORTAL_DIR = resolve(__dirname, '..');
const PUBLIC_DIR = resolve(PORTAL_DIR, 'public');
const dist = resolve(process.argv[2] ?? resolve(PORTAL_DIR, 'dist'));

const wellKnownSrc = resolve(PUBLIC_DIR, '.well-known');
if (!existsSync(resolve(wellKnownSrc, 'mcp/server-cards.json'))) {
  console.error('discovery-sync: public/.well-known/mcp/server-cards.json missing — run generate-agent-discovery.mjs first');
  process.exit(1);
}

mkdirSync(dist, { recursive: true });
cpSync(wellKnownSrc, resolve(dist, '.well-known'), { recursive: true });

const files = ['llms.txt', 'llms-full.txt', 'agent-card.json', 'agents.json'];
for (const f of files) {
  const src = resolve(PUBLIC_DIR, f);
  if (existsSync(src)) cpSync(src, resolve(dist, f));
}

// Canary: the card must parse where it landed.
JSON.parse(readFileSync(resolve(dist, '.well-known/mcp/server-cards.json'), 'utf8'));

console.log(`discovery-sync: dist ready (${dist})`);
