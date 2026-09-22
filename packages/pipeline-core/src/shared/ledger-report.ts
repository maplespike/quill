/**
 * Quill — ingestion freshness reporting
 *
 * An ingestion run records its outcome with the API so /v1/data/quality can
 * answer "is this data current?" about data the API did not fetch itself.
 *
 * The ledger is owned by the API (it writes the file the quality report reads),
 * so a run in a CronJob pod reports over HTTP with a short-lived internal JWT —
 * the same contract the API enforces on /v1/internal/ingest-report
 * (audience quill-internal, issuer quill-services).
 *
 * Reporting is best-effort and never throws: a failure to report must not fail
 * an ingestion run that otherwise succeeded, but it is logged loudly because a
 * silent failure shows up later as unexplained staleness.
 */

import { createHmac } from 'node:crypto';

export interface IngestReport {
  module: string;
  status: 'success' | 'failure';
  records?: number;
  error?: string;
  at?: string;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** Mint an HS256 internal-service JWT matching the API's verifyToken contract. */
export function mintInternalToken(secret: string, service: string, ttlSeconds = 300, now = Date.now()): string {
  if (!secret || secret.length < 32) throw new Error('INTERNAL_JWT_SECRET must be at least 32 characters');
  const iat = Math.floor(now / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    sub: `svc:${service}`,
    tier: 'internal',
    iss: 'quill-services',
    aud: 'quill-internal',
    iat,
    exp: iat + ttlSeconds,
  }));
  const signing = `${header}.${payload}`;
  return `${signing}.${b64url(createHmac('sha256', secret).update(signing).digest())}`;
}

/**
 * Report one ingestion outcome to the API. Resolves true when recorded.
 * Returns false (never throws) when reporting is disabled or unavailable.
 */
export async function reportIngest(
  report: IngestReport,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const secret = env['INTERNAL_JWT_SECRET'];
  const base = env['QUILL_API_URL'];
  if (env['QUILL_LEDGER_REPORT'] === '0') return false;
  if (!secret || !base) return false;
  try {
    const token = mintInternalToken(secret, 'ingest');
    const response = await fetchImpl(`${base.replace(/\/$/, '')}/v1/internal/ingest-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': token },
      body: JSON.stringify({ ...report, at: report.at ?? new Date().toISOString() }),
    });
    if (!response.ok) {
      console.error(`[ledger] report for ${report.module} rejected: HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[ledger] report for ${report.module} failed:`, err instanceof Error ? err.message : err);
    return false;
  }
}
