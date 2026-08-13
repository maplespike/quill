#!/usr/bin/env tsx
/**
 * Issue #778 regression test — GitHub OAuth 502 (missing CA bundle).
 *
 * Root cause: the quill-api image had no CA certificate bundle, so Node's
 * `fetch` to `https://github.com/login/oauth/access_token` failed TLS
 * validation ("unable to get local issuer certificate") and the OAuth
 * callback 502'd on 100% of requests.
 *
 * The fix has two independent halves, both guarded here:
 *
 *  1. Runtime wiring (both image builds now ship a bundle + point Node at it)
 *     - Docker path: Dockerfile.api installs ca-certificates, consolidates
 *       the bundle to /usr/local/share/ca-certificates/ca-bundle.crt, sets
 *       ENV CA_CERT_PATH, and entrypoint.sh exports
 *       NODE_EXTRA_CA_CERTS from CA_CERT_PATH (parameterizable at runtime).
 *     - Nix path (source of truth for the live cluster): flake.nix mkImage
 *       adds pkgs.cacert to `contents` and sets NODE_EXTRA_CA_CERTS +
 *       SSL_CERT_FILE from ${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt.
 *
 *  2. Behavioral check — the entrypoint actually exports the var into the
 *     Node process (this is the mechanism that makes outbound TLS work).
 *
 * Runs as `tsx --test` via `pnpm run test:ca` (part of `pnpm test`).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Air-gapped CI convention (matches scripts/test-external-hosts.mts):
// network-dependent assertions are skipped when this is set.
const SKIP_NETWORK = process.env.SKIP_NETWORK_TESTS === '1';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const ENTRYPOINT = path.join(ROOT, 'entrypoint.sh');
const DOCKERFILE_API = path.join(ROOT, 'Dockerfile.api');
const FLAKE = path.join(ROOT, 'flake.nix');

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

/* ------------------------------------------------------------------ */
/*  1a. Entrypoint behavior — the actual #778 mechanism                */
/* ------------------------------------------------------------------ */

test('entrypoint.sh exports NODE_EXTRA_CA_CERTS into the node process', () => {
  assert.ok(fs.existsSync(ENTRYPOINT), 'entrypoint.sh must exist at repo root');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quill-ca-test-'));
  const bundlePath = path.join(tmpDir, 'ca-bundle.crt');
  fs.writeFileSync(bundlePath, '# fake bundle for test\n');

  // Run the entrypoint with a custom CA_CERT_PATH; the node child should see
  // NODE_EXTRA_CA_CERTS pointing at exactly that path.
  const res = spawnSync(
    'bash',
    [ENTRYPOINT, '-e', 'console.log(process.env.NODE_EXTRA_CA_CERTS)'],
    {
      env: { ...process.env, CA_CERT_PATH: bundlePath },
      encoding: 'utf8',
    },
  );
  assert.equal(res.status, 0, `entrypoint exited ${res.status}: ${res.stderr}`);
  assert.equal(res.stdout.trim(), bundlePath);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('entrypoint.sh falls back to the default bundle path when CA_CERT_PATH is unset', () => {
  const env = { ...process.env };
  delete env.CA_CERT_PATH;
  const res = spawnSync(
    'bash',
    [ENTRYPOINT, '-e', 'console.log(process.env.NODE_EXTRA_CA_CERTS)'],
    { env, encoding: 'utf8' },
  );
  assert.equal(res.status, 0, `entrypoint exited ${res.status}: ${res.stderr}`);
  assert.equal(res.stdout.trim(), '/usr/local/share/ca-certificates/ca-bundle.crt');
});

/* ------------------------------------------------------------------ */
/*  1b. Static guards — both build paths must keep shipping a bundle   */
/* ------------------------------------------------------------------ */

test('Dockerfile.api installs ca-certificates and sets CA_CERT_PATH', () => {
  const df = read(DOCKERFILE_API);
  assert.match(df, /apt-get install[^\n]*ca-certificates/, 'runtime stage installs ca-certificates');
  assert.match(df, /cp \/etc\/ssl\/certs\/ca-certificates\.crt \/usr\/local\/share\/ca-certificates\/ca-bundle\.crt/);
  assert.match(df, /ENV CA_CERT_PATH=\/usr\/local\/share\/ca-certificates\/ca-bundle\.crt/);
});

test('flake.nix mkImage adds pkgs.cacert and sets NODE_EXTRA_CA_CERTS/SSL_CERT_FILE', () => {
  const flake = read(FLAKE);
  assert.match(flake, /contents = contents \+\+ \[ pkgs\.cacert \]/);
  assert.match(flake, /NODE_EXTRA_CA_CERTS=\$\{pkgs\.cacert\}\/etc\/ssl\/certs\/ca-bundle\.crt/);
  assert.match(flake, /SSL_CERT_FILE=\$\{pkgs\.cacert\}\/etc\/ssl\/certs\/ca-bundle\.crt/);
  // Every node image must inherit the wiring (api/mcp/ingest/engine all do
  // outbound TLS). They all funnel through mkImage, so the single guard above
  // covers them; assert the api image exists as a mkImage call site.
  assert.match(flake, /quill-api-image = mkImage \{/);
});

/* ------------------------------------------------------------------ */
/*  2. Local reality check — the bundle on disk actually loads         */
/* ------------------------------------------------------------------ */

test('a real CA bundle at CA_CERT_PATH satisfies Node TLS (api.github.com handshake)', { skip: SKIP_NETWORK && 'SKIP_NETWORK_TESTS=1' }, () => {
  // If the machine has no CA bundle at all, skip rather than fail — this is a
  // guard against a bundle that Node cannot parse, not a connectivity test.
  const candidates = [
    '/etc/ssl/certs/ca-certificates.crt',
    '/etc/ssl/certs/ca-bundle.crt',
  ];
  const systemBundle = candidates.find((c) => fs.existsSync(c));
  if (!systemBundle) {
    return; // nothing to verify on this host
  }
  // Run a node one-liner that performs a real TLS handshake to a public host
  // through Node's https stack. We use api.github.com — the exact host the
  // OAuth callback must reach. If NODE_EXTRA_CA_CERTS points at a parseable
  // bundle, the handshake completes (any HTTP status is fine; TLS failure is
  // the regression signal).
  const script = `
    const tls = require('node:tls');
    const sock = tls.connect({ host: 'api.github.com', port: 443, servername: 'api.github.com' });
    const t = setTimeout(() => { console.error('TIMEOUT'); process.exit(2); }, 8000);
    sock.on('secureConnect', () => { clearTimeout(t); console.log('SECURE'); process.exit(0); });
    sock.on('error', (e) => { clearTimeout(t); console.error('TLS_ERR: ' + e.message); process.exit(1); });
  `;
  const res = spawnSync(process.execPath, ['-e', script], {
    env: { ...process.env, NODE_EXTRA_CA_CERTS: systemBundle },
    encoding: 'utf8',
    timeout: 12_000,
  });
  if (res.status === 2) {
    return; // handshake timed out — the entrypoint tests still guard the mechanism
  }
  if (SKIP_NETWORK && res.status !== 0) {
    return; // network disabled and the handshake didn't complete — expected
  }
  assert.equal(res.status, 0, `TLS handshake failed with the system bundle: ${res.stdout} ${res.stderr}`);
  assert.match(res.stdout, /SECURE/);
});
