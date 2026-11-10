/**
 * /v1/security/audit-summary — freshness gate.
 *
 * Incident (QUILL-AUDIT.md 2026-10-24, P1): the live endpoint answered 200 with
 *   { generatedAt: "1970-01-01T00:00:00.000Z", summary: { total: 0, ... },
 *     note: "live audit failed: spawn pnpm ENOENT; no static audit.json found either" }
 * so the site's "Live Dependency Security" panel published a clean bill of
 * health from a source that had never run. Absence was rendered as zero.
 *
 * The fix: a failed live audit with no usable snapshot is 503 with the reason.
 * "Usable" means parseable, not a placeholder, and younger than 7 days.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { probeCommand } from '../../../../scripts/lib/command-probe.mjs';
import {
  AUDIT_SNAPSHOT_REASON,
  MAX_SNAPSHOT_AGE_SECONDS,
  readStaticFallback,
  securityAuditSummaryHandler,
  snapshotRejection,
  type AuditPayload,
} from '../routes/security-audit.js';
import { makeCtx } from './_helpers.js';

const ZERO = { total: 0, critical: 0, high: 0, moderate: 0, low: 0, info: 0 };

function payload(overrides: Partial<AuditPayload> = {}): AuditPayload {
  return { generatedAt: new Date().toISOString(), summary: { ...ZERO }, top: [], ...overrides };
}

const dirs: string[] = [];

function tempSnapshot(content: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'quill-audit-snapshot-'));
  dirs.push(dir);
  const file = join(dir, 'audit.json');
  writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}

test.after(() => {
  delete process.env.QUILL_SECURITY_AUDIT_JSON;
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/* ── snapshot classification ─────────────────────────────────────────── */

test('an epoch-dated zero report is rejected as stale', () => {
  const epoch = payload({ generatedAt: '1970-01-01T00:00:00.000Z' });
  const reason = snapshotRejection(epoch, 'live audit failed');
  assert.ok(reason, 'epoch-dated snapshot must be rejected');
  assert.match(String(reason), /stale/);
});

test('a fresh scan result is usable', () => {
  assert.equal(snapshotRejection(payload(), 'live audit failed'), null);
});

test('a snapshot older than the limit is rejected', () => {
  const old = payload({
    generatedAt: new Date(Date.now() - (MAX_SNAPSHOT_AGE_SECONDS + 60) * 1000).toISOString(),
  });
  assert.match(String(snapshotRejection(old, 'live audit failed')), /stale/);
});

test('a generated placeholder (note set) is not a scan result', () => {
  const stub = payload({ note: 'pnpm audit unavailable — wrote stub (no pnpm-lock.yaml)' });
  assert.match(String(snapshotRejection(stub, 'live audit failed')), /placeholder/);
});

test('a payload with no readable date is rejected', () => {
  const broken = { ...payload(), generatedAt: 'not-a-date' } as AuditPayload;
  assert.match(String(snapshotRejection(broken, 'live audit failed')), /not a date/);
});

/* ── static fallback reader ─────────────────────────────────────────── */

test('readStaticFallback marks a missing file unusable and names the reason', async () => {
  const configured = join(tmpdir(), 'quill-audit-does-not-exist.json');
  process.env.QUILL_SECURITY_AUDIT_JSON = configured;
  const result = await readStaticFallback('live audit failed: spawn pnpm ENOENT');
  assert.equal(result.source, 'static');
  assert.equal(result.usable, false);
  assert.match(result.fallbackReason, /pnpm ENOENT/);
  // Regressing this would let a broken override answer from another snapshot:
  // CI tracks packages/portal/public/data/security/audit.json, so falling
  // through to the cwd guesses made this test pass locally and fail in CI
  // (2026-10-24). The configured path must be named, and no data served.
  assert.match(result.fallbackReason, /QUILL_SECURITY_AUDIT_JSON/);
  assert.equal(result.payload.summary.total, 0);
});

test('readStaticFallback serves a fresh file and refuses an epoch-dated one', async () => {
  const freshPayload = payload();
  process.env.QUILL_SECURITY_AUDIT_JSON = tempSnapshot(freshPayload);
  const fresh = await readStaticFallback('live audit failed');
  assert.equal(fresh.usable, true);
  assert.equal(fresh.payload.summary.total, 0);
  // The file's generatedAt is the scan time. Do not stamp a new one, and
  // do not invent a note the snapshot did not carry.
  assert.equal(fresh.payload.generatedAt, freshPayload.generatedAt);
  assert.equal(fresh.payload.note, undefined);
  assert.equal(fresh.fallbackReason, 'live audit failed');

  process.env.QUILL_SECURITY_AUDIT_JSON = tempSnapshot(
    payload({ generatedAt: '1970-01-01T00:00:00.000Z' }),
  );
  const epoch = await readStaticFallback('live audit failed');
  assert.equal(epoch.usable, false);
  assert.match(epoch.fallbackReason, /stale/);
});

test('readStaticFallback refuses an unparseable file', async () => {
  process.env.QUILL_SECURITY_AUDIT_JSON = tempSnapshot('<html>Cloudflare WAF</html>');
  const result = await readStaticFallback('live audit failed');
  assert.equal(result.usable, false);
  assert.match(result.fallbackReason, /unreadable/);
});

/* ── route contract ─────────────────────────────────────────────────── */

test('the route answers 503 with the reason when no usable audit exists', async () => {
  const configured = join(tmpdir(), 'quill-audit-does-not-exist.json');
  process.env.QUILL_SECURITY_AUDIT_JSON = configured;

  const res = await securityAuditSummaryHandler(new Request('http://test.local/v1/security/audit-summary'), makeCtx());
  assert.equal(res.status, 503);
  const body = (await res.json()) as {
    success: boolean;
    error: { code: string; message: string; message_fr: string; details?: Array<Record<string, unknown>> };
  };
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'AUDIT_QUERY_FAILED');
  assert.match(body.error.message, /QUILL_SECURITY_AUDIT_JSON/);
  assert.ok(body.error.message_fr && body.error.message_fr !== 'Erreur inconnue');
  assert.match(String(body.error.details?.[0]?.reason), /QUILL_SECURITY_AUDIT_JSON/);
  assert.equal(body.error.details?.[0]?.source, 'static');
});

test('the handler serves the snapshot, does not spawn, and keeps generatedAt', async () => {
  // Two days old: inside the 7-day window, and clearly not "now".
  const generatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  process.env.QUILL_SECURITY_AUDIT_JSON = tempSnapshot({
    generatedAt,
    summary: { ...ZERO, total: 4, high: 1, moderate: 3 },
    top: [{ id: 'GHSA-1', package: 'example', severity: 'high', title: 'Example' }],
  });

  const bin = mkdtempSync(join(tmpdir(), 'quill-audit-bin-'));
  dirs.push(bin);
  const marker = join(bin, 'spawned.txt');
  const script = `#!/bin/sh\necho "$0" >> ${JSON.stringify(marker)}\nexit 0\n`;
  for (const name of ['pnpm', 'corepack', 'npx', 'npm']) {
    const file = join(bin, name);
    writeFileSync(file, script);
    chmodSync(file, 0o755);
  }

  const previousPath = process.env.PATH;
  process.env.PATH = `${bin}:${previousPath ?? ''}`;
  const started = Date.now();
  try {
    const res = await securityAuditSummaryHandler(
      new Request('http://test.local/v1/security/audit-summary'),
      makeCtx(),
    );
    const elapsed = Date.now() - started;
    assert.equal(existsSync(marker), false, 'handler started a pnpm, corepack, npx, or npm process');
    assert.ok(elapsed < 500, `handler took ${elapsed}ms`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      success: boolean;
      data: {
        generatedAt: string;
        note?: string;
        summary: { total: number; high: number; moderate: number };
        top: Array<{ id: string }>;
        _meta: {
          source: string;
          generatedAgeSeconds: number;
          maxSnapshotAgeSeconds: number;
          fallbackReason: string;
        };
      };
    };
    assert.equal(body.success, true);
    assert.equal(body.data.generatedAt, generatedAt);
    assert.ok(body.data._meta.generatedAgeSeconds > 3600, 'generatedAt was stamped as now');
    assert.equal(body.data.note, undefined);
    assert.equal(body.data.summary.total, 4);
    assert.equal(body.data.summary.high, 1);
    assert.equal(body.data.summary.moderate, 3);
    assert.equal(body.data.top[0]?.id, 'GHSA-1');
    assert.equal(body.data._meta.source, 'static');
    assert.equal(body.data._meta.maxSnapshotAgeSeconds, MAX_SNAPSHOT_AGE_SECONDS);
    assert.equal(body.data._meta.fallbackReason, AUDIT_SNAPSHOT_REASON);
  } finally {
    process.env.PATH = previousPath;
  }
});

test('the route module does not start a subprocess', () => {
  const src = readFileSync(new URL('../routes/security-audit.ts', import.meta.url), 'utf8');
  assert.equal(/\b(child_process|execFile|spawn|execSync|fork)\b/.test(src), false);
});

/* ── refresh-script probes ──────────────────────────────────────────── */

test('a hanging probe times out and does not throw', { timeout: 3_000 }, async () => {
  const started = Date.now();
  const result = await probeCommand(
    process.execPath,
    ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1e9);'],
    { timeoutMs: 400 },
  );
  const elapsed = Date.now() - started;
  assert.equal(result, null);
  assert.ok(elapsed >= 300, `probe returned in ${elapsed}ms without waiting for the timeout`);
  assert.ok(elapsed < 2_000, `probe hung for ${elapsed}ms`);
});

test('a missing probe binary is non-fatal', async () => {
  const started = Date.now();
  const result = await probeCommand('quill-probe-missing-bin', ['--version'], { timeoutMs: 500 });
  assert.equal(result, null);
  assert.ok(Date.now() - started < 1_000);
});
