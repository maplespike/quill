/**
 * Quill — Dependency security audit snapshot
 *
 * GET /v1/security/audit-summary
 *
 * Serves the build-time snapshot written by `scripts/gen-security-audit.mjs`.
 * A request does not run `pnpm audit` and does not start a subprocess.
 * `generatedAt` is the timestamp stored in that file. This handler does
 * not replace it with the current time.
 *
 * Refresh the snapshot off the request path:
 *   node scripts/gen-security-audit.mjs
 *   pnpm -F @maplespike/portal gen:security
 * The API image build runs the same script (`Dockerfile.api`). The CI
 * `audit` job step "Emit audit.json snapshot" writes raw `pnpm audit --json`
 * into the gitignored snapshot path; it is not a second scheduler.
 * Binary lookups in the refresh script time out after a few seconds
 * (`scripts/lib/command-probe.mjs`) and failure there is non-fatal.
 *
 * A missing, placeholder, or unparseable snapshot is HTTP 503. Absence
 * is not a clean bill of health (QUILL-AUDIT.md, 2026-10-24). A snapshot
 * older than 7 days is still HTTP 200: the file's generatedAt is kept,
 * and the body sets stale to true.
 *
 * Response schema matches the static file so OwaspDashboard's types
 * stay valid. `_meta.source` is `static`. The OpenAPI path is
 * GET /v1/security/audit-summary.
 */

import type { RouteHandler } from '../types.js';
import { buildError, buildSuccess, jsonResponse } from '../response.js';

/* ------------------------------------------------------------------ */
/*  Types — match the static audit.json shape verbatim               */
/* ------------------------------------------------------------------ */

interface AuditSummary {
  total: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
  info: number;
}

interface AuditAdvisory {
  id: string;
  package: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  title: string;
  url?: string;
}

export interface AuditPayload {
  generatedAt: string;
  summary: AuditSummary;
  top: AuditAdvisory[];
  note?: string;
}

type AuditResult = {
  source: 'static';
  payload: AuditPayload;
  fallbackReason: string;
  usable: boolean;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const ZERO_SUMMARY: AuditSummary = {
  total: 0,
  critical: 0,
  high: 0,
  moderate: 0,
  low: 0,
  info: 0,
};

/**
 * Why a successful response is a snapshot. Kept on `_meta.fallbackReason`
 * so existing clients still see that field. It is not a live-audit failure.
 */
export const AUDIT_SNAPSHOT_REASON =
  'build-time snapshot from scripts/gen-security-audit.mjs';

/**
 * Resolve the path to the build-time audit.json that the dashboard
 * used to read directly. Multiple candidate locations so the route
 * works in both `pnpm dev` (cwd = repo root) and `pnpm build` cwd =
 * packages/api-server. Async + dynamic node:* imports keep the
 * Cloudflare Workers bundle honest: without this, the top-level
 * `node:fs` import crashes module-init in Workers projects that
 * haven't enabled `nodejs_compat`.
 */
async function findStaticAuditPath(): Promise<{ path: string | null; missingOverride?: string }> {
  const { existsSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  // Explicit override first: the api image bakes the snapshot at a stable path
  // (/app/data/security/audit.json) that is not one of the cwd-relative
  // guesses below.
  //
  // An override is authoritative. When it names a file that is not there, do
  // NOT fall through to the guesses: the API would then serve a *different*
  // snapshot as if it were the configured one, which is the same lie this
  // route exists to stop (2026-10-24: the CI checkout has a committed
  // packages/portal/public/data/security/audit.json, so a broken override
  // silently answered from it).
  const override = process.env.QUILL_SECURITY_AUDIT_JSON;
  if (override) {
    return existsSync(override)
      ? { path: resolve(override) }
      : { path: null, missingOverride: resolve(override) };
  }
  const candidates = [
    // dev: cwd = repo root
    'packages/portal/public/data/security/audit.json',
    // packaged: cwd = packages/api-server
    '../portal/public/data/security/audit.json',
    // docker: cwd = /app inside the image
    '/app/packages/portal/public/data/security/audit.json',
    // docker (Dockerfile.api bakes the generated snapshot here)
    '/app/data/security/audit.json',
  ];
  for (const c of candidates) {
    if (existsSync(resolve(c))) return { path: resolve(c) };
  }
  return { path: null };
}

/**
 * Age after which a served snapshot is marked stale. The route still
 * returns HTTP 200 with the file's generatedAt. It does not 503.
 */
export const MAX_SNAPSHOT_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface SnapshotFreshness {
  ageSeconds: number;
  ageDays: number;
  stale: boolean;
}

/**
 * Age of a snapshot timestamp. `stale` is true only after 7 days.
 * A date that does not parse yields age 0 and stale false; the caller
 * refuses that file before this runs.
 */
export function snapshotFreshness(generatedAt: string, now: number = Date.now()): SnapshotFreshness {
  const generatedMs = Date.parse(generatedAt);
  if (!Number.isFinite(generatedMs)) {
    return { ageSeconds: 0, ageDays: 0, stale: false };
  }
  const ageSeconds = Math.floor((now - generatedMs) / 1000);
  return {
    ageSeconds,
    ageDays: Math.max(0, Math.floor(ageSeconds / 86_400)),
    stale: ageSeconds > MAX_SNAPSHOT_AGE_SECONDS,
  };
}

/**
 * Why a snapshot may not be served, or null when it is usable.
 *
 * QUILL-AUDIT.md (2026-10-24, P1): `/v1/security/audit-summary` published
 * `generatedAt: 1970-01-01T00:00:00.000Z` with every count at 0 and HTTP 200.
 * The fallback built that payload when `pnpm audit` failed AND no static file
 * existed, so the dashboard's "Live Dependency Security" panel read a clean
 * bill of health from a source that never ran. Absence is not zero.
 *
 * Age is not a refusal. An old file is served with stale: true.
 */
export function snapshotRejection(
  payload: AuditPayload | null,
  reason: string,
): string | null {
  if (!payload) return reason;
  const generatedAt = Date.parse(payload.generatedAt);
  if (!Number.isFinite(generatedAt)) {
    return `snapshot generatedAt is not a date (${String(payload.generatedAt)})`;
  }
  // scripts/gen-security-audit.mjs writes `note` only when it could not run
  // `pnpm audit` — that file is a placeholder, not a scan result.
  if (typeof payload.note === 'string' && payload.note.trim().length > 0) {
    return `snapshot is a placeholder, not a scan: ${payload.note.trim()}`;
  }
  return null;
}

/**
 * Read the static fallback. `usable` is false when the snapshot must not be
 * served as a successful answer; the caller turns that into a 503.
 */
export async function readStaticFallback(reason: string): Promise<AuditResult> {
  const found = await findStaticAuditPath();
  const path = found.path;
  if (!path) {
    const rejection = found.missingOverride
      ? `QUILL_SECURITY_AUDIT_JSON points at ${found.missingOverride}, which does not exist (${reason})`
      : `no static audit.json found (${reason})`;
    return {
      source: 'static',
      fallbackReason: rejection,
      usable: false,
      payload: {
        generatedAt: new Date(0).toISOString(),
        summary: { ...ZERO_SUMMARY },
        top: [],
        note: rejection,
      },
    };
  }
  try {
    const { readFileSync } = await import('node:fs');
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as AuditPayload;
    const rejection = snapshotRejection(parsed, reason);
    if (rejection === null) {
      // Serve the file as it was written. generatedAt stays the snapshot
      // time. Do not add a note and do not stamp "now".
      return {
        source: 'static',
        fallbackReason: reason,
        usable: true,
        payload: parsed,
      };
    }
    return {
      source: 'static',
      fallbackReason: rejection,
      usable: false,
      payload: {
        ...parsed,
        note: parsed.note ? `${parsed.note} | ${rejection}` : rejection,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const rejection = `static audit.json at ${path} unreadable: ${msg}`;
    return {
      source: 'static',
      fallbackReason: rejection,
      usable: false,
      payload: {
        generatedAt: new Date(0).toISOString(),
        summary: { ...ZERO_SUMMARY },
        top: [],
        note: rejection,
      },
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Route Handler                                                     */
/* ------------------------------------------------------------------ */

export const securityAuditSummaryHandler: RouteHandler = async (_request, ctx) => {
  const result = await readStaticFallback(AUDIT_SNAPSHOT_REASON);

  if (!result.usable) {
    // Absence is not zero. A missing or unusable snapshot is a 503 that
    // names the reason, never a 200 with an epoch-dated zero report.
    return jsonResponse(
      buildError(
        'AUDIT_QUERY_FAILED',
        `Dependency audit unavailable: ${result.fallbackReason}`,
        ctx,
        503,
        [{ reason: result.fallbackReason, source: 'static', retryAfterSeconds: 60 }],
      ),
      503,
    );
  }

  const freshness = snapshotFreshness(result.payload.generatedAt);
  return jsonResponse(
    buildSuccess(
      {
        ...result.payload,
        stale: freshness.stale,
        ageDays: freshness.ageDays,
        _meta: {
          source: result.source,
          generatedAgeSeconds: freshness.ageSeconds,
          ageDays: freshness.ageDays,
          stale: freshness.stale,
          maxSnapshotAgeSeconds: MAX_SNAPSHOT_AGE_SECONDS,
          fallbackReason: result.fallbackReason,
        },
      },
      ctx,
    ),
    200,
  );
};
