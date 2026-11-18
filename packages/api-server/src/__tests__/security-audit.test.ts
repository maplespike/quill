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
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  MAX_SNAPSHOT_AGE_SECONDS,
  readStaticFallback,
  securityAuditSummaryHandler,
  setAuditRunnerForTests,
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
  setAuditRunnerForTests(null);
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

test('readStaticFallback does not guess a portal path when the env is unset', async () => {
  delete process.env.QUILL_SECURITY_AUDIT_JSON;
  const result = await readStaticFallback('live audit failed');
  assert.equal(result.usable, false);
  assert.match(result.fallbackReason, /QUILL_SECURITY_AUDIT_JSON is not set/);
});

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
  process.env.QUILL_SECURITY_AUDIT_JSON = tempSnapshot(payload());
  const fresh = await readStaticFallback('live audit failed');
  assert.equal(fresh.usable, true);
  assert.equal(fresh.payload.summary.total, 0);

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
  setAuditRunnerForTests(async () => ({
    source: 'static',
    usable: false,
    fallbackReason: 'no static audit.json found (live audit failed: spawn pnpm ENOENT)',
    payload: payload({ generatedAt: '1970-01-01T00:00:00.000Z', note: 'stub' }),
  }));

  const res = await securityAuditSummaryHandler(new Request('http://test.local/v1/security/audit-summary'), makeCtx());
  assert.equal(res.status, 503);
  const body = (await res.json()) as {
    success: boolean;
    error: { code: string; message: string; message_fr: string; details?: Array<Record<string, unknown>> };
  };
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'AUDIT_QUERY_FAILED');
  assert.match(body.error.message, /pnpm ENOENT/);
  assert.ok(body.error.message_fr && body.error.message_fr !== 'Erreur inconnue');
  assert.match(String(body.error.details?.[0]?.reason), /pnpm ENOENT/);
});

test('the route answers 200 when a fresh snapshot exists', async () => {
  setAuditRunnerForTests(async () => ({
    source: 'static',
    usable: true,
    fallbackReason: 'live audit failed: spawn pnpm ENOENT',
    payload: payload(),
  }));

  const res = await securityAuditSummaryHandler(new Request('http://test.local/v1/security/audit-summary'), makeCtx());
  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: { _meta: Record<string, unknown> } };
  assert.equal(body.data._meta.source, 'static');
  assert.equal(body.data._meta.maxSnapshotAgeSeconds, MAX_SNAPSHOT_AGE_SECONDS);
});

test('the route answers 200 for a live scan', async () => {
  setAuditRunnerForTests(async () => ({
    source: 'live',
    payload: payload({ summary: { ...ZERO, total: 2, high: 2 } }),
  }));

  const res = await securityAuditSummaryHandler(new Request('http://test.local/v1/security/audit-summary'), makeCtx());
  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: { summary: { total: number }; _meta: { source: string } } };
  assert.equal(body.data.summary.total, 2);
  assert.equal(body.data._meta.source, 'live');
});
