// SPDX-License-Identifier: AGPL-3.0-only
/** Quill claim hashes cover canonicalized Quill records, not upstream source bytes. */

import { computeHash } from '../verification/hashing.js';
import { buildMerkleRoot } from '../ingestion/attestation/index.js';
import { scoreProvenance } from '../quality/provenance.js';
import type { ProvenanceScore } from '../quality/types.js';
import { NO_REUSE_LICENSE_NOTICE } from '../shared/attribution.js';
import type { LicenseMetadataBasis } from '../shared/attribution.js';
import { buildProvenanceEvidence, redactArtifactUrl } from './evidence.js';
import type { ClaimProvenanceEvidence, PublisherTermsEvidenceInput, SourceArtifactEvidenceInput } from './types.js';

export { buildProvenanceEvidence } from './evidence.js';
export type { ClaimProvenanceEvidence, PublisherTermsEvidenceInput, SourceArtifactEvidenceInput } from './types.js';

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(record).sort()) sorted[key] = sortValue(record[key]);
    return sorted;
  }
  return value;
}

export interface ClaimItem {
  claim: string;
  value: unknown;
  sourceName: string;
  /** A source/record URL, not necessarily the URL that returned source bytes. */
  sourceUrl: string;
  /** Source retrieval time only when acquisition evidence supplies it; never claim registration time. */
  retrievedAt?: string;
  sourceArtifactsEvidence?: SourceArtifactEvidenceInput[];
  publisherTermsEvidence?: PublisherTermsEvidenceInput;
  license?: string;
  licenseUrl?: string;
  licenseBasis?: LicenseMetadataBasis;
  attributionText?: string;
  updateFrequency?: string;
  transformations?: string[];
  /**
   * Retained raw artifact: the exact canonical JSON serialization of `value`
   * that the recorded sha256 was computed over. Persisted so a claim can be
   * re-verified from retained bytes months later — even if the canonicalization
   * algorithm itself changes — instead of depending on re-fetching upstream.
   */
  rawBody?: string;
}

export interface ClaimBundle extends ClaimItem {
  /** SHA-256 of canonicalJson(value). */
  sha256: string;
  /** New bundles always write v1 evidence; persisted legacy rows are normalized at the store boundary. */
  provenanceEvidence: ClaimProvenanceEvidence;
  merkleRoot?: string;
  quality?: ProvenanceScore;
}

export const DEFAULT_CLAIM_LICENSE = NO_REUSE_LICENSE_NOTICE;

export interface BuildClaimBundleOptions {
  /** Ambient request artifacts captured inside runModule; kept separate from record-supplied evidence. */
  capturedArtifactsEvidence?: SourceArtifactEvidenceInput[];
}

export async function buildClaimBundle(item: ClaimItem, options: BuildClaimBundleOptions = {}): Promise<ClaimBundle> {
  // The retained raw body IS the hashed artifact: it must serialize exactly
  // as the digest says it does, so hashing it must reproduce the digest.
  // When a caller has not retained one, hash the freshly canonicalized value
  // and retain that exact serialization on the bundle.
  const hashedBody = item.rawBody ?? canonicalJson(item.value);
  const sha256 = await computeHash(hashedBody, 'sha256');
  const provenanceEvidence = buildProvenanceEvidence(sha256, item, options);
  const capturedAt = provenanceEvidence.acquisition.artifacts
    .find(artifact => artifact.association === 'url-matched-not-content-verified')?.retrieved_at;
  // The normalized snake_case evidence block is the persisted representation;
  // do not also serialize unsanitized input evidence that may contain secrets.
  const {
    sourceArtifactsEvidence: _sourceArtifactsEvidence,
    publisherTermsEvidence: _publisherTermsEvidence,
    ...bundleItem
  } = item;
  const safeSourceUrl = redactArtifactUrl(item.sourceUrl)?.url ?? item.sourceUrl;
  const safeLicenseUrl = item.licenseUrl
    ? redactArtifactUrl(item.licenseUrl)?.url ?? item.licenseUrl
    : undefined;
  const safePublisherTermsEvidence = item.publisherTermsEvidence
    ? {
        ...item.publisherTermsEvidence,
        ...(item.publisherTermsEvidence.url
          ? { url: redactArtifactUrl(item.publisherTermsEvidence.url)?.url ?? item.publisherTermsEvidence.url }
          : {}),
      }
    : undefined;
  const bundle: ClaimBundle = {
    ...bundleItem,
    sourceUrl: safeSourceUrl,
    ...(safeLicenseUrl ? { licenseUrl: safeLicenseUrl } : {}),
    retrievedAt: capturedAt,
    sha256,
    provenanceEvidence,
    ...(safePublisherTermsEvidence ? { publisherTermsEvidence: safePublisherTermsEvidence } : {}),
    license: item.license?.trim() ? item.license : DEFAULT_CLAIM_LICENSE,
    licenseBasis: item.licenseBasis ?? 'no-publisher-declaration',
    attributionText: item.attributionText ?? DEFAULT_CLAIM_LICENSE,
    transformations: item.transformations ?? [],
    // Retention (#989): the bundle carries the exact bytes the digest covers.
    rawBody: hashedBody,
  };
  bundle.quality = scoreProvenance({
    source: item.sourceName,
    citation: {
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      dataHash: sha256,
      retrievedAt: bundle.retrievedAt ?? undefined,
      license: bundle.license,
      merkleRoot: bundle.merkleRoot,
    },
    // A record hash does not prove that a Merkle chain or signature was verified.
    hashChainVerified: false,
  });
  return bundle;
}

export async function buildClaimBatch(
  items: ClaimItem[],
): Promise<{ bundles: ClaimBundle[]; merkleRoot: string }> {
  const bundles = await Promise.all(items.map(item => buildClaimBundle(item)));
  const { root } = await buildMerkleRoot(bundles.map(bundle => bundle.sha256));
  return { bundles: bundles.map(bundle => ({ ...bundle, merkleRoot: root })), merkleRoot: root };
}

export async function verifyClaimHash(value: unknown, claimedSha256: string): Promise<boolean> {
  const recomputed = await computeHash(canonicalJson(value), 'sha256');
  const normalized = claimedSha256.toLowerCase().replace(/^sha256[:-]/, '');
  return recomputed === normalized;
}
