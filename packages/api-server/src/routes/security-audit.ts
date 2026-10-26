/**
 * Quill — Live Dependency Security Audit
 *
 * GET /v1/security/audit-summary
 *
 * Re-runs `pnpm audit --json` server-side on each call (subject to a
 * short TTL + request coalescing), so the OWASP dashboard's "Live
 * Dependency Security" panel stops serving stale build-time data
 * without the user noticing.
 *
 * Behaviour:
 *   - Node.js mode (production in this repo's Dockerfile): spawns
 *     `pnpm audit --json` from $PROJECT_ROOT (or `process.cwd()`),
 *     normalises the output, returns it with a freshness signal.
 *   - Cloudflare Workers mode (dual-mode fallbac): child_process
 *     isn't available, so we fall back to reading the build-time
 *     static file written by `scripts/gen-security-audit.mjs` and
 *     surface a `note` field explaining the staleness.
 *   - pnpm audit itself fails (non-zero, no JSON, network): falls
 *     back to the same static file rather than 500-ing.
 *
 * Response schema is identical to the static file so OwaspDashboard's
 * TypeScript types are reused as-is.
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

type AuditResult =
  | { source: 'live'; payload: AuditPayload }
  | { source: 'static'; payload: AuditPayload; fallbackReason: string; usable: boolean };

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

const SEV_RANK: Record<AuditAdvisory['severity'], number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  low: 3,
  info: 4,
};

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
 * Maximum age of a build-time audit snapshot that may be served as a
 * successful answer. Beyond this the endpoint reports 503: a week-old
 * dependency audit is not evidence about today's lockfile.
 */
export const MAX_SNAPSHOT_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Why a snapshot may not be served, or null when it is usable.
 *
 * QUILL-AUDIT.md (2026-10-24, P1): `/v1/security/audit-summary` published
 * `generatedAt: 1970-01-01T00:00:00.000Z` with every count at 0 and HTTP 200.
 * The fallback built that payload when `pnpm audit` failed AND no static file
 * existed, so the dashboard's "Live Dependency Security" panel read a clean
 * bill of health from a source that never ran. Absence is not zero.
 */
export function snapshotRejection(
  payload: AuditPayload | null,
  reason: string,
  now: number = Date.now(),
): string | null {
  if (!payload) return reason;
  const generatedAt = Date.parse(payload.generatedAt);
  if (!Number.isFinite(generatedAt)) {
    return `snapshot generatedAt is not a date (${String(payload.generatedAt)})`;
  }
  const ageSeconds = Math.floor((now - generatedAt) / 1000);
  if (ageSeconds > MAX_SNAPSHOT_AGE_SECONDS) {
    return `snapshot is stale: generated ${payload.generatedAt} (${ageSeconds}s old, limit ${MAX_SNAPSHOT_AGE_SECONDS}s)`;
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
    return {
      source: 'static',
      fallbackReason: rejection ?? reason,
      usable: rejection === null,
      payload: {
        ...parsed,
        note: parsed.note
          ? `${parsed.note} | ${reason}`
          : `${reason} — showing build-time snapshot`,
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

/**
 * Normalise raw pnpm audit --json output into the dashboard's payload
 * shape. Mirrors scripts/gen-security-audit.mjs exactly so behaviour
 * stays consistent across the two code paths.
 */
function normalizePnpmAudit(raw: unknown): AuditPayload {
  const advisories =
    (raw && typeof raw === 'object' && 'advisories' in (raw as Record<string, unknown>)
      ? (raw as { advisories?: Record<string, unknown> }).advisories
      : undefined) ??
    (raw && typeof raw === 'object' && 'vulnerabilities' in (raw as Record<string, unknown>)
      ? (raw as { vulnerabilities?: Record<string, unknown> }).vulnerabilities
      : undefined) ??
    {};

  const summary: AuditSummary = { ...ZERO_SUMMARY };
  const top: AuditAdvisory[] = [];

  for (const [id, adv] of Object.entries(advisories)) {
    if (!adv || typeof adv !== 'object') continue;
    const a = adv as Record<string, unknown>;
    const sevRaw = String(a.severity ?? 'info').toLowerCase();
    const severity: AuditAdvisory['severity'] =
      ['critical', 'high', 'moderate', 'low', 'info'].includes(sevRaw)
        ? (sevRaw as AuditAdvisory['severity'])
        : 'info';
    summary[severity] = (summary[severity] ?? 0) + 1;
    summary.total += 1;

    // Pull the package name from the first finding path if present,
    // mirroring scripts/gen-security-audit.mjs.
    const firstFinding = Array.isArray(a.findings) ? a.findings[0] : undefined;
    const firstPath = firstFinding && typeof firstFinding === 'object'
      ? (firstFinding as Record<string, unknown>).paths
      : undefined;
    const pkg =
      (Array.isArray(firstPath) && typeof firstPath[0] === 'string'
        ? firstPath[0].split('>')[0]?.trim()
        : undefined) ??
      (typeof a.module_name === 'string' ? a.module_name : id);

    const recommendations = Array.isArray(a.recommendations) ? a.recommendations : [];
    top.push({
      id,
      package: pkg,
      severity,
      title:
        (typeof a.title === 'string' && a.title) ||
        (typeof a.description === 'string' && a.description) ||
        id,
      url:
        (typeof a.url === 'string' && a.url) ||
        (typeof recommendations[0] === 'string' ? recommendations[0] : undefined),
    });
  }

  top.sort(
    (a, b) =>
      SEV_RANK[a.severity] - SEV_RANK[b.severity] ||
      a.package.localeCompare(b.package),
  );

  return { generatedAt: new Date().toISOString(), summary, top: top.slice(0, 20) };
}

/**
 * Detect Cloudflare Workers — process.versions.node is undefined and
 * dynamic import('node:child_process') would fail at runtime. We gate
 * the spawn attempt up-front so we never even try in Workers.
 */
function isNodeRuntime(): boolean {
  return (
    typeof process !== 'undefined' &&
    typeof (process as { versions?: { node?: string } }).versions?.node === 'string'
  );
}

/**
 * In-flight run coalescing. Two simultaneous requests after a cache
 * miss should share a single pnpm audit invocation rather than
 * spawning two competing subprocesses.
 */
let activeAuditPromise: Promise<AuditResult> | null = null;

/**
 * Test seam: the handler runs `pnpm audit` in Node, which a unit test must not
 * do. Set a fake to exercise the fallback and 503 paths; reset with null.
 */
let auditRunnerForTests: (() => Promise<AuditResult>) | null = null;

export function setAuditRunnerForTests(fn: (() => Promise<AuditResult>) | null): void {
  auditRunnerForTests = fn;
}

function runAudit(): Promise<AuditResult> {
  return auditRunnerForTests ? auditRunnerForTests() : runAuditCoalesced();
}


/**
 * Spawn `pnpm audit --json` from the right cwd and parse the result.
 * pnpm audit returns non-zero when vulnerabilities exist but still
 * emits a JSON document on stdout, so we capture stdout even on * non-zero exit.
 */

/**
 * Resolve a working pnpm binary. Probe order: corepack shim, npx
 * shim, bare PATH. Last-ditch PATH lookup may ENOENT in containers
 * where corepack shims aren't on the api-server runtime user's
 * PATH. Caller catches that and falls back to the static snapshot.
 */
async function resolvePnpm(
  childProcess: typeof import('node:child_process'),
): Promise<{ bin: string; prefixArgs: string[] }> {
  const probe = (
    bin: string,
    args: string[],
  ): Promise<string | null> =>
    new Promise<string | null>((resolve) => {
      try {
        childProcess.execFile(
          bin,
          args,
          { encoding: 'utf8' },
          (err, stdout) => {
            if (err) return resolve(null);
            const trimmed = String(stdout || '').trim();
            resolve(trimmed.length > 0 ? trimmed : null);
          },
        );
      } catch {
        resolve(null);
      }
    });

  const fromCorepack = await probe('corepack', ['which', 'pnpm']);
  if (fromCorepack) return { bin: fromCorepack, prefixArgs: [] };

  const fromNpx = await probe('npx', ['--no-install', 'which', 'pnpm']);
  if (fromNpx) return { bin: fromNpx, prefixArgs: [] };

  // Final fallback: bare pnpm on PATH.
  return { bin: 'pnpm', prefixArgs: [] };
}

async function runPnpmAudit(): Promise<AuditResult> {
  const cwd = process.env.PROJECT_ROOT || process.cwd();
  try {
    // Resolve the pnpm binary first (corepack shim → npx → PATH) and
    // dynamic-import child_process so Cloudflare Workers bundler does
    // not import it.
    const child_process = await import('node:child_process');
    const { bin, prefixArgs } = await resolvePnpm(child_process);

    const stdout = await new Promise<string>((resolve, reject) => {
      child_process.execFile(
        bin,
        [...prefixArgs, 'audit', '--json'],
        { cwd, encoding: 'utf8', timeout: 60_000, maxBuffer: 64 * 1024 * 1024 },
        (err, stdout, stderr) => {
          // pnpm exits non-zero on vulns but writes JSON to stdout.
          // Capture stdout if present; otherwise escalate.
          if (stdout && stdout.trim().length > 0) {
            resolve(stdout);
            return;
          }
          const msg =
            stderr?.toString().split('\n').slice(0, 3).join('\n') ||
            err?.message ||
            'pnpm audit produced no stdout';
          reject(new Error(msg));
        },
      );
    });

    const parsed = JSON.parse(stdout);
    const payload = normalizePnpmAudit(parsed);
    return { source: 'live', payload };
  } catch (err) {
    const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
    return await readStaticFallback(`live audit failed: ${msg}`);
  }
}

/**
 * Public, single-flight entry — coalesce concurrent calls into one
 * in-flight pnpm-audit run, then share its result.
 *
 * IMPORTANT: capture the promise in a local `p` so two concurrent
 * callers don't race past the truthiness check and overwrite each
 * other's in-flight promise (which would orphan the first run and
 * waste a real `pnpm audit` invocation).
 */
function runAuditCoalesced(): Promise<AuditResult> {
  let p = activeAuditPromise;
  if (!p) {
    p = runPnpmAudit().finally(() => {
      // Clear after a 1s grace so callers arriving right after settle
      // still reuse the cached value without spawning a fresh pnpm.
      setTimeout(() => {
        activeAuditPromise = null;
      }, 1000);
    });
    activeAuditPromise = p;
  }
  return p;
}

/* ------------------------------------------------------------------ */
/*  Route Handler                                                     */
/* ------------------------------------------------------------------ */

export const securityAuditSummaryHandler: RouteHandler = async (_request, ctx) => {
  const serve = (result: AuditResult) => {
    if (result.source === 'static' && !result.usable) {
      // Absence is not zero. A failed live audit with no usable snapshot is a
      // 503 that names the reason, never a 200 with an epoch-dated zero report.
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
    const ageSeconds = Math.floor(
      (Date.now() - new Date(result.payload.generatedAt).getTime()) / 1000,
    );
    return jsonResponse(
      buildSuccess(
        {
          ...result.payload,
          _meta: {
            source: result.source,
            generatedAgeSeconds: ageSeconds,
            maxSnapshotAgeSeconds: MAX_SNAPSHOT_AGE_SECONDS,
            ...(result.source === 'static' ? { fallbackReason: result.fallbackReason } : {}),
          },
        },
        ctx,
      ),
      200,
      // Default Cache-Control: no-cache, no-store, must-revalidate (set by
      // response.ts + applySecurityHeaders) is exactly what we want for a
      // freshness-explicit observability endpoint; don't try to override it.
    );
  };

  if (!isNodeRuntime()) {
    // Cloudflare Workers: no subprocess. Serve the build-time snapshot when it
    // is fresh, otherwise 503 for the same reason the Node path does.
    return serve(await readStaticFallback('running on Cloudflare Workers (no child_process)'));
  }

  return serve(await runAudit());
};
