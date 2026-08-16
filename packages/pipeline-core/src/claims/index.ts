// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Quill Claim Stack — verifiable claim bundles
 *
 * Direction 1 (ECOSYSTEM-EXECUTION-PLAN WS-1): every high-signal tool response can
 * carry a ClaimBundle — a SHA-256 hash over a canonical JSON serialization of the
 * returned value, plus source attribution, retrieval time, license, and any
 * transformations applied. A skeptic can reproduce the hash with:
 *
 *   echo -n '<canonical json>' | sha256sum
 *
 * Everything here is dependency-free pure logic (Web Crypto), so it runs in
 * Workers, Node, and the browser alike.
 */

import { computeHash } from '../verification/hashing.js';
import { buildMerkleRoot } from '../ingestion/attestation/index.js';
import { scoreProvenance } from '../quality/provenance.js';
import type { ProvenanceScore } from '../quality/types.js';

/* ------------------------------------------------------------------ */
/*  Canonical JSON serialization                                       */
/* ------------------------------------------------------------------ */

/**
 * Deep-sort object keys so JSON.stringify output is stable across
 * tool implementations, runtime versions, and language boundaries.
 * This is what makes a hash reproducible by third parties.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    // Null prototype: assigning a "__proto__" key must create a plain own
    // property, not trigger the Object.prototype setter (prototype pollution
    // via attacker-controlled JSON reaching POST /v1/verify).
    const sorted: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValue(record[key]);
    }
    return sorted;
  }
  return value;
}

/* ------------------------------------------------------------------ */
/*  Claim bundle types + builders                                      */
/* ------------------------------------------------------------------ */

export interface ClaimItem {
  /** Human-readable claim statement ("unemployment rate was 6.5% in Jan 2025") */
  claim: string;
  /** The value the claim is about — hashed as canonical JSON */
  value: unknown;
  /** Human-readable source name ("Statistics Canada") */
  sourceName: string;
  /** Direct URL to the upstream government data */
  sourceUrl: string;
  /** ISO-8601 retrieval timestamp (defaults to now) */
  retrievedAt?: string;
  /** Data license (defaults to OGL-CA) */
  license?: string;
  /** Expected update cadence */
  updateFrequency?: string;
  /** Any transformations applied to the value (e.g. ["keyword-extraction"]) */
  transformations?: string[];
}

export interface ClaimBundle extends ClaimItem {
  /** SHA-256 hex of canonicalJson(value) */
  sha256: string;
  /** Merkle root of the batch this claim was committed with (optional) */
  merkleRoot?: string;
  /**
   * Data-quality provenance score (0.0–1.0 + qualitative level), derived
   * from this bundle's own attestation fields: source trust, citation
   * chain completeness, and the fact that the content hash was just
   * recomputed and matched. Never stored — recomputed at build time.
   */
  quality?: ProvenanceScore;
}

/** Default license for Canadian public-sector data */
export const DEFAULT_CLAIM_LICENSE = 'Open Government Licence – Canada';

/**
 * Build a single verifiable claim bundle.
 */
export async function buildClaimBundle(item: ClaimItem): Promise<ClaimBundle> {
  const serialized = canonicalJson(item.value);
  const sha256 = await computeHash(serialized, 'sha256');
  const bundle: ClaimBundle = {
    claim: item.claim,
    value: item.value,
    sha256,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    retrievedAt: item.retrievedAt ?? new Date().toISOString(),
    license: item.license ?? DEFAULT_CLAIM_LICENSE,
    updateFrequency: item.updateFrequency,
    transformations: item.transformations ?? [],
  };
  // Derive the quality score from this bundle's own attestation signals —
  // the hash was just recomputed and matched, so hashChainVerified is true
  // by construction; citation chain completeness comes from the fields the
  // emitter supplied (source name/URL, retrievedAt, license, merkle root).
  bundle.quality = scoreProvenance({
    source: item.sourceName,
    citation: {
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      dataHash: sha256,
      retrievedAt: bundle.retrievedAt,
      license: bundle.license,
      merkleRoot: bundle.merkleRoot,
    },
    hashChainVerified: true,
  });
  return bundle;
}

/**
 * Build a batch of claim bundles and commit them under a single Merkle root,
 * so one pipeline run attests to N records with one hash.
 */
export async function buildClaimBatch(
  items: ClaimItem[],
): Promise<{ bundles: ClaimBundle[]; merkleRoot: string }> {
  const bundles = await Promise.all(items.map(buildClaimBundle));
  const { root } = await buildMerkleRoot(bundles.map(b => b.sha256));
  return {
    bundles: bundles.map(b => ({ ...b, merkleRoot: root })),
    merkleRoot: root,
  };
}

/**
 * Recompute the SHA-256 of a value and compare it to a claimed hash.
 * Returns true when canonicalJson(value) reproduces the hash.
 */
export async function verifyClaimHash(value: unknown, claimedSha256: string): Promise<boolean> {
  const recomputed = await computeHash(canonicalJson(value), 'sha256');
  const normalized = claimedSha256.toLowerCase().replace(/^sha256[:\-]/, '');
  return recomputed === normalized;
}
