/**
 * Quill — Citation Endpoint (Real)
 *
 * GET /v1/citation/:hash — Look up a Quill record by its canonical JSON SHA-256.
 *
 * A stored or indexed hash match checks record integrity. It does not authenticate
 * the source response or establish source-data reuse rights.
 *
 * Hash format: sha256:<64 hex characters>.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { computeHash, canonicalJson, citationStore } from '@maplespike/pipeline-core';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import pino from 'pino';

const log = pino({
  level: process.env.QUILL_LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
});

/* ------------------------------------------------------------------ */
/*  Pipeline data loader                                               */
/* ------------------------------------------------------------------ */


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pipelineData: Record<string, any> | null = null;

function loadPipelineData(): Record<string, any> | null {
  if (pipelineData) return pipelineData;

  const paths = [
    resolve(__dirname, '../../../../packages/portal/assets/pipeline-data.json'),
    resolve('/data/projects/own/maplespike/packages/portal/assets/pipeline-data.json'),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, 'utf-8');
        pipelineData = JSON.parse(raw);
        log.info(`Loaded pipeline data from ${p} (${raw.length} bytes)`);
        return pipelineData;
      } catch (err) {
        log.error(`Failed to load ${p}: ${err}`);
      }
    }
  }
  log.error('Pipeline data not found at any path');
  return null;
}

/* ------------------------------------------------------------------ */
/*  Pipeline data traversal (generic record search)                    */
/* ------------------------------------------------------------------ */

interface CitationResult {
  source: string;
  record: Record<string, unknown>;
  computedHash: string;
  /** Rich claim-store metadata (only present for store-backed hits). */
  retrievedAt?: string;
  license?: string;
  licenseUrl?: string;
  licenseBasis?: 'publisher-metadata' | 'source-configuration' | 'no-publisher-declaration';
  attributionText?: string;
  updateFrequency?: string;
  claim?: string;
  sourceUrl?: string;
  /** Captured evidence from store-backed hits; null/absent elsewhere means not available. */
  provenanceEvidence?: import('@maplespike/pipeline-core').ClaimProvenanceEvidence;
  quality?: {
    score: number;
    level: string;
    sourceTrustScore: number;
    citationVerified: boolean;
  };
}

// Lazy hash index over the pipeline data file (built once on first miss).
let pipelineHashIndex: Promise<Map<string, CitationResult>> | null = null;

async function buildPipelineHashIndex(
  data: Record<string, any>,
): Promise<Map<string, CitationResult>> {
  const index = new Map<string, CitationResult>();
  const pending: Promise<void>[] = [];

  const visit = (value: unknown, defaultSource: string): void => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, defaultSource);
      return;
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      // Records that carry an explicit URL are hashable leaves.
      if (typeof record.url === 'string' || typeof record.source === 'string') {
        const source = (typeof record.source === 'string' && record.source)
          || (typeof record.sourceName === 'string' && record.sourceName)
          || defaultSource;
        const serialized = canonicalJson(record);
        pending.push(
          computeHash(serialized, 'sha256').then((hash) => {
            index.set(hash, { source, record, computedHash: hash });
          }),
        );
      }
      for (const [, v] of Object.entries(record)) visit(v, defaultSource);
    }
  };

  visit(data, 'Government of Canada');
  await Promise.all(pending);
  log.info(`Pipeline hash index built: ${index.size} records indexed`);
  return index;
}

function getPipelineHashIndex(): Promise<Map<string, CitationResult>> | null {
  const data = loadPipelineData();
  if (!data) return null;
  if (!pipelineHashIndex) {
    pipelineHashIndex = buildPipelineHashIndex(data).catch((err) => {
      log.error(`Pipeline hash index build failed: ${err}`);
      pipelineHashIndex = null; // allow retry
      throw err;
    });
  }
  return pipelineHashIndex;
}

async function findRecordByHash(targetHash: string): Promise<CitationResult | null> {
  // 1. Shared claim store (populated by MCP tools via withClaims()/registerCitation).
  const stored = citationStore.get(targetHash);
  if (stored) {
    const record = (typeof stored.bundle.value === 'object' && stored.bundle.value !== null)
      ? stored.bundle.value as Record<string, unknown>
      : { data: stored.serialized };
    return {
      source: stored.bundle.sourceName,
      record,
      computedHash: targetHash,
      // Thread the claim bundle's evidence through; retrieval time is populated
      // only from an associated acquisition artifact by the store decoder.
      retrievedAt: stored.bundle.retrievedAt,
      license: stored.bundle.license,
      licenseUrl: stored.bundle.licenseUrl,
      licenseBasis: stored.bundle.licenseBasis,
      attributionText: stored.bundle.attributionText,
      updateFrequency: stored.bundle.updateFrequency,
      claim: stored.bundle.claim,
      sourceUrl: stored.bundle.sourceUrl,
      provenanceEvidence: stored.bundle.provenanceEvidence,
      quality: stored.bundle.quality
        ? {
            score: stored.bundle.quality.score,
            level: stored.bundle.quality.level,
            sourceTrustScore: stored.bundle.quality.sourceTrustScore,
            citationVerified: stored.bundle.quality.citationVerified,
          }
        : undefined,
    };
  }

  // 2. Fallback: scan pipeline-data.json for a record whose canonical hash matches.
  const indexPromise = getPipelineHashIndex();
  if (indexPromise) {
    const index = await indexPromise;
    const hit = index.get(targetHash);
    if (hit) return hit;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Handler                                                           */
/* ------------------------------------------------------------------ */

export const getCitationHandler: RouteHandler = async (_request, ctx, params) => {
  const rawHash = params.id || '';

  // Parse "sha256:hex" format — strip prefix, accept hex-only
  let targetHash = rawHash;
  if (targetHash.startsWith('sha256:')) {
    targetHash = targetHash.slice(7);
  } else if (targetHash.startsWith('sha256-')) {
    targetHash = targetHash.slice(7);
  }

  // Validate hex
  if (!/^[a-f0-9]{64}$/i.test(targetHash)) {
    return jsonResponse(
      buildError('INVALID_HASH', 'Invalid SHA-256 hash format. Expected "sha256:<64 hex chars>"', ctx),
      400,
    );
  }

  targetHash = targetHash.toLowerCase();

  try {
    const result = await findRecordByHash(targetHash);

    if (!result) {
      return jsonResponse(
        buildError('CITATION_NOT_FOUND', `No record is currently indexed for hash sha256:${targetHash}. This lookup does not determine whether a source record was changed or where a hash originated.`, ctx),
        404,
      );
    }

    const citation: Record<string, unknown> = {
      source_name: result.source || 'Government of Canada',
      source_url: result.record.source_url || result.record.url || '',
      license: result.license ?? 'No publisher license declaration was supplied for this response. Quill grants no reuse rights; consult the original source terms.',
      ...(result.licenseUrl ? { license_url: result.licenseUrl } : {}),
      license_basis: result.licenseBasis ?? 'no-publisher-declaration',
      provenance_evidence: result.provenanceEvidence ?? null,
      ...(result.attributionText ? { attribution_text: result.attributionText } : {}),
      data_hash: targetHash,
      retrieved_at: result.retrievedAt ?? null,
      update_frequency: 'unknown',
    };
    if (result.quality) {
      citation.quality = result.quality;
    }

    return jsonResponse(buildSuccess({
      // This is a successful hash lookup, not source authentication.
      verified: true,
      verification_scope: citationStore.has(targetHash) ? 'claim-store-hash-match' : 'pipeline-index-hash-match',
      provenance_evidence: result.provenanceEvidence ?? null,
      citation,
      verify_command: `echo -n '${canonicalJson(result.record).replace(/'/g, "'\\''")}' | sha256sum`,
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Citation lookup failed';
    return jsonResponse(buildError('CITATION_ERROR', message, ctx), 500);
  }
};

/* ------------------------------------------------------------------ */
/*  Verify Claim routes (Claim Stack WS-1f)                            */
/* ------------------------------------------------------------------ */

/**
 * GET /v1/claims/verify/:hash — check a hash against the claim store and
 * the pipeline data index. Returns 200 { verified: true/false }.
 */
export const getVerifyClaimHandler: RouteHandler = async (_request, ctx, params) => {
  const rawHash = params.hash || '';
  let targetHash = rawHash;
  if (targetHash.startsWith('sha256:')) targetHash = targetHash.slice(7);
  else if (targetHash.startsWith('sha256-')) targetHash = targetHash.slice(7);

  if (!/^[a-f0-9]{64}$/i.test(targetHash)) {
    return jsonResponse(buildError('INVALID_HASH', 'Invalid SHA-256 hash format', ctx), 400);
  }
  targetHash = targetHash.toLowerCase();

  try {
    const result = await findRecordByHash(targetHash);
    if (!result) {
      return jsonResponse(buildSuccess({
        verified: false,
        found: false,
        sha256: targetHash,
        source: '',
        source_name: '',
        source_url: '',
        retrieved_at: null,
        license: null,
        provenance_evidence: null,
      }, ctx));
    }
    const sourceConfig = getSourceConfig(result.source);
    const sourceUrl = result.sourceUrl || result.record.source_url || result.record.url || '';
    // Store-backed bundles carry a human-readable sourceName already (e.g.
    // "Statistics Canada"); the config map only translates internal registry
    // keys (hoc, senate…) from pipeline-data hits. Prefer the bundle's own
    // name unless getSourceConfig produced a real mapped display name.
    const sourceName =
      sourceConfig.name !== `MapleSpike — ${result.source}`
        ? sourceConfig.name
        : (result.source || sourceConfig.name);
    return jsonResponse(buildSuccess({
      verified: true,
      found: true,
      sha256: targetHash,
      // Short machine key (back-compat with earlier clients)
      source: result.source,
      // Full journalist-facing provenance
      source_name: sourceName,
      source_url: sourceUrl,
      retrieved_at: result.retrievedAt ?? null,
      ...(citationStore.get(targetHash) ? { claim_created_at: citationStore.get(targetHash)?.createdAt ?? null } : {}),
      license: result.license ?? 'No publisher license declaration was supplied for this response. Quill grants no reuse rights; consult the original source terms.',
      ...(result.licenseUrl ? { license_url: result.licenseUrl } : {}),
      license_basis: result.licenseBasis ?? 'no-publisher-declaration',
      provenance_evidence: result.provenanceEvidence ?? null,
      verification_scope: citationStore.has(targetHash) ? 'claim-store-hash-match' : 'pipeline-index-hash-match',
      ...(result.attributionText ? { attribution_text: result.attributionText } : {}),
      update_frequency: result.updateFrequency ?? 'not supplied',
      claim: result.claim ?? '',
      quality: result.quality ?? null,
      verify_command: `echo -n '${canonicalJson(result.record).replace(/'/g, "'\\''")}' | sha256sum`,
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Claim verification failed';
    return jsonResponse(buildError('CLAIM_VERIFY_ERROR', message, ctx), 500);
  }
};

/**
 * POST /v1/claims/verify — body: { data: unknown, sha256?: string }
 * Recomputes the SHA-256 of canonical JSON of `data` and returns
 * { verified, recomputed_sha256, matches_claimed }. Works for any payload,
 * no Quill storage required — the trust primitive for non-MCP callers.
 */
export const postVerifyClaimHandler: RouteHandler = async (request, ctx) => {
  // This route is public (authExempt) — cap the body so arbitrary JSON can't
  // be used to burn CPU/memory hashing multi-MB payloads. Rate limiting also
  // applies per-IP for anonymous callers (see index.ts enforceRateLimit).
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 1024 * 1024) {
    return jsonResponse(buildError('INVALID_BODY', 'Request body exceeds the 1 MiB limit', ctx), 413);
  }
  let body: { data?: unknown; sha256?: string };
  try {
    body = await request.json() as { data?: unknown; sha256?: string };
  } catch {
    return jsonResponse(buildError('INVALID_BODY', 'Request body must be valid JSON', ctx), 400);
  }

  if (body.data === undefined) {
    return jsonResponse(buildError('INVALID_BODY', 'Field "data" is required', ctx), 400);
  }

  try {
    const serialized = canonicalJson(body.data);
    const recomputed = await computeHash(serialized, 'sha256');
    const claimed = (body.sha256 ?? '').toLowerCase().replace(/^sha256[:-]/, '');
    const matches = claimed.length === 64 ? recomputed === claimed : null;
    return jsonResponse(buildSuccess({
      verified: matches === true,
      recomputed_sha256: recomputed,
      matches_claimed: matches,
      verify_command: `echo -n '${serialized.replace(/'/g, "'\\''")}' | sha256sum`,
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Claim verification failed';
    return jsonResponse(buildError('CLAIM_VERIFY_ERROR', message, ctx), 500);
  }
};

/* ------------------------------------------------------------------ */
/*  Claims index (public discovery)                                    */
/* ------------------------------------------------------------------ */

/**
 * GET /v1/claims/latest — most recently registered claim bundles.
 * Public (authExempt + free-tier): lets journalists, other MCP authors, and
 * downstream pipelines discover what Quill has attested without a key, then
 * verify any single hash via GET /v1/claims/verify/:hash.
 */
export const getLatestClaimsHandler: RouteHandler = async (_request, ctx) => {
  try {
    const claims = citationStore.latest(25);
    return jsonResponse(buildSuccess({
      count: claims.length,
      claims: claims.map((c) => ({
        sha256: `sha256:${c.hash}`,
        claim: c.claim,
        source_name: c.sourceName,
        source_url: c.sourceUrl,
        retrieved_at: c.retrievedAt,
        license: c.license,
        update_frequency: c.updateFrequency,
        claim_created_at: c.createdAt,
        created_at: c.createdAt,
        provenance_status: 'inspect-verification-endpoint',
      })),
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Claims index failed';
    return jsonResponse(buildError('CLAIMS_INDEX_ERROR', message, ctx), 500);
  }
};

/* ------------------------------------------------------------------ */
/*  Source metadata                                                    */
/* ------------------------------------------------------------------ */

interface SourceInfo {
  name: string;
  url: string;
}

function getSourceConfig(sourceKey: string): SourceInfo {
  const configs: Record<string, SourceInfo> = {
    hoc:    { name: 'House of Commons — Committee Evidence', url: 'https://www.ourcommons.ca/Committees/' },
    senate: { name: 'Senate of Canada — Committee Evidence', url: 'https://sencanada.ca/en/committees/' },
    gazette:{ name: 'Canada Gazette', url: 'https://gazette.gc.ca/' },
    gic:    { name: 'Governor-in-Council Appointments', url: 'https://gazette.gc.ca/gc/gic/' },
    lmia:   { name: 'LMIA Data — Employment and Social Development Canada', url: 'https://www.canada.ca/en/employment-social-development.html' },
    corporate: { name: 'Federal Lobbying Registry', url: 'https://lobbycanada.gc.ca/' },
    influence: { name: 'Influence Actor Registry', url: 'https://apps.cra-arc.gc.ca/' },
    elections: { name: 'Elections Canada', url: 'https://www.elections.ca/' },
    oversight: { name: 'Oversight Bodies — OAG, PBO, Ethics, CB, CRTC', url: 'https://www.oag-bvg.gc.ca/' },
    canlii:    { name: 'CanLII — Canadian Legal Information Institute', url: 'https://www.canlii.org/' },
  };
  return configs[sourceKey] || { name: `MapleSpike — ${sourceKey}`, url: 'https://quill.maplespike.ca/' };
}
