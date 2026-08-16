/**
 * Claim Stack helper — attach verifiable claim bundles to tool responses.
 *
 * Every tool that returns upstream government records should wrap its
 * response with withClaims() so the response carries SHA-256 hashes over
 * each returned value, plus source attribution and retrieval time. The
 * hashes are registered in the shared CitationStore and can be verified via
 * get_citation / verify_claim / /v1/citation without holding the original data.
 */

import { buildClaimBundle, citationStore } from '@maplespike/pipeline-core';
import type { ClaimBundle, ProvenanceScore } from '@maplespike/pipeline-core';

export interface Claimable {
  claim: string;
  value: unknown;
  sourceName: string;
  sourceUrl: string;
  transformations?: string[];
}

/** Public (hash-only) shape returned to agents — raw values stay out. */
export interface PublicClaim {
  claim: string;
  sha256: string;
  sourceName: string;
  sourceUrl: string;
  retrievedAt: string;
  license: string;
  transformations: string[];
  merkleRoot?: string;
  /** Data-quality provenance score (0–1) + level, from the quality scorer */
  quality?: ProvenanceScore;
}

function toPublicClaim(b: ClaimBundle): PublicClaim {
  return {
    claim: b.claim,
    sha256: b.sha256,
    sourceName: b.sourceName,
    sourceUrl: b.sourceUrl,
    retrievedAt: b.retrievedAt ?? '',
    license: b.license ?? '',
    transformations: b.transformations ?? [],
    merkleRoot: b.merkleRoot,
    quality: b.quality,
  };
}

/**
 * Build + register claim bundles for the given items and append a `claims`
 * array to the response content. Returns a shallow copy of content with the
 * claims attached.
 */
export async function withClaims(
  content: Record<string, unknown>,
  items: Claimable[],
): Promise<Record<string, unknown>> {
  const bundles: ClaimBundle[] = [];
  for (const item of items) {
    const bundle = await buildClaimBundle(item);
    citationStore.put(bundle);
    bundles.push(bundle);
  }
  return { ...content, claims: bundles.map(toPublicClaim) };
}
