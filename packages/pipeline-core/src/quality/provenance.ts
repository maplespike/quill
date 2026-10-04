// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Provenance Scoring — Quill
 *
 * Evaluates the trustworthiness and traceability of data sources by
 * combining three dimensions:
 *   1. Source trust — pre-configured domain trust scores
 *   2. Citation verification — is the citation chain intact?
 *   3. Cryptographic verification — hash chain and Ed25519 signatures
 *
 * Scores:
 *   0.95–1.0  excellent — trusted source, full attestation, signatures verified
 *   0.80–0.94 good     — known source, citations present, some verification
 *   0.60–0.79 fair     — unknown source, citations present but unverified
 *   0.30–0.59 poor     — no citations, source untrusted
 *   < 0.30   unknown   — no source metadata at all
 */

import type { ProvenanceScore, QualityLevel } from './types.js';
import { scoreToLevel } from './types.js';

/* ------------------------------------------------------------------ */
/*  Source Trust Scores (mirrors curation/scoring.ts)                  */
/* ------------------------------------------------------------------ */

/**
 * Pre-configured trust scores for known source domains (0–100).
 * Higher = more trusted. Used as the base for provenance evaluation.
 */
export const PROVENANCE_SOURCE_SCORES: Record<string, number> = {
  // Canadian government & official (highest trust)
  'canada.ca': 98,
  'statcan.gc.ca': 97,
  'pm.gc.ca': 95,
  'parl.ca': 95,
  'laws-lois.justice.gc.ca': 97,
  'canlii.org': 96,

  // Federal departments & agencies
  'tbs-sct.canada.ca': 95,
  'pspc-spac.gc.ca': 94,
  'infc.gc.ca': 93,
  'ic.gc.ca': 93,
  'canada.ca/en/treasury-board-secretariat': 95,

  // Provincial governments
  'ontario.ca': 92,
  'gov.on.ca': 92,
  'gov.bc.ca': 92,
  'alberta.ca': 92,
  'quebec.ca': 90,

  // Major Canadian media
  'cbc.ca': 80,
  'globeandmail.com': 80,
  'thestar.com': 75,
  'nationalpost.com': 70,
  'lapresse.ca': 80,

  // International official / wire
  'reuters.com': 85,
  'apnews.com': 85,
  'bbc.com': 75,
  'bbc.co.uk': 75,
  'oecd.org': 90,
  'un.org': 90,
  'worldbank.org': 88,
  'imf.org': 88,

  // Adversarial / low-trust
  'rt.com': 5,
  'sputniknews.com': 5,
  'tass.com': 10,
  'xinhuanet.com': 15,
  'cgtn.com': 15,
  'farsnews.ir': 5,
  'presstv.ir': 5,
};

/**
 * Default trust score for unknown sources.
 */
export const DEFAULT_SOURCE_TRUST = 50;

/**
 * Look up the trust score for a source URL/name (0–100).
 * Extracts domain and checks the known-scores map.
 * Returns DEFAULT_SOURCE_TRUST for unknown sources.
 */
export function computeSourceTrust(source: string): number {
  const domain = source
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');

  for (const [key, score] of Object.entries(PROVENANCE_SOURCE_SCORES)) {
    if (domain === key || domain.endsWith(`.${key}`) || domain.includes(key)) {
      return score;
    }
  }
  return DEFAULT_SOURCE_TRUST;
}

/* ------------------------------------------------------------------ */
/*  Citation verification helpers                                      */
/* ------------------------------------------------------------------ */

export interface CitationInfo {
  /** Whether a citation object is present */
  present: boolean;
  /** Whether sourceName is non-empty */
  hasSourceName: boolean;
  /** Whether sourceUrl is a valid URL */
  hasSourceUrl: boolean;
  /** Whether a data hash is present */
  hasDataHash: boolean;
  /** Whether retrievedAt timestamp is present */
  hasRetrievedAt: boolean;
  /** Whether the hash chain / merkle root is present */
  hasMerkleRoot: boolean;
  /** Whether an Ed25519 signature is present */
  hasSignature: boolean;
  /** Whether a license is specified */
  hasLicense: boolean;
}

/**
 * Analyze a citation for verification signals.
 */
export function analyzeCitation(citation: unknown): CitationInfo {
  if (!citation || typeof citation !== 'object') {
    return {
      present: false,
      hasSourceName: false,
      hasSourceUrl: false,
      hasDataHash: false,
      hasRetrievedAt: false,
      hasMerkleRoot: false,
      hasSignature: false,
      hasLicense: false,
    };
  }

  const c = citation as Record<string, unknown>;
  return {
    present: true,
    hasSourceName: typeof c.sourceName === 'string' && c.sourceName.length > 0,
    hasSourceUrl: typeof c.sourceUrl === 'string' && c.sourceUrl.startsWith('http'),
    hasDataHash: typeof c.dataHash === 'string' && c.dataHash.length > 0,
    hasRetrievedAt: typeof c.retrievedAt === 'string' && c.retrievedAt.length > 0,
    hasMerkleRoot: typeof c.merkleRoot === 'string' && c.merkleRoot.length > 0,
    hasSignature: typeof c.signature === 'string' && c.signature.length > 0,
    hasLicense: typeof c.license === 'string' && c.license.length > 0,
  };
}

/**
 * Score the citation chain (0.0 – 1.0).
 *
 * Weighted scoring of citation attributes:
 *   - Present citation:            +0.20
 *   - Source name present:         +0.15
 *   - Source URL present:          +0.15
 *   - Data hash present:           +0.15
 *   - Retrieved-at timestamp:      +0.10
 *   - License present:             +0.10
 *   - Merkle root present:         +0.10
 *   - Signature present:           +0.05
 */
export function scoreCitationChain(citation: unknown): number {
  const info = analyzeCitation(citation);
  if (!info.present) return 0;

  let score = 0;
  if (info.hasSourceName) score += 0.15;
  if (info.hasSourceUrl) score += 0.15;
  if (info.hasDataHash) score += 0.15;
  if (info.hasRetrievedAt) score += 0.10;
  if (info.hasLicense) score += 0.10;
  if (info.hasMerkleRoot) score += 0.15;
  if (info.hasSignature) score += 0.10;
  return Math.round(score * 1000) / 1000;
}

/* ------------------------------------------------------------------ */
/*  Provenance scoring                                                 */
/* ------------------------------------------------------------------ */

export interface ProvenanceInput {
  /** Source name or URL */
  source: string;
  /** Citation object (from attestation module) */
  citation?: unknown;
  /** Whether the hash/merkle chain has been verified */
  hashChainVerified?: boolean;
  /** Whether the Ed25519 signature has been verified */
  signatureVerified?: boolean;
  /** Whether attestation metadata is present */
  hasAttestation?: boolean;
}

/**
 * Score the provenance of a data source.
 *
 * Algorithm:
 *   sourceTrustScore     = computeSourceTrust(...) / 100
 *   citationScore        = scoreCitationChain(...)
 *   hashVerified         = hashChainVerified ? 1 : 0
 *   signatureVerified    = signatureVerified  ? 1 : 0
 *   attestationBonus     = hasAttestation ? 0.05 : 0
 *
 *   composite = sourceTrustScore × 0.40
 *             + citationScore     × 0.25
 *             + hashVerified      × 0.15
 *             + signatureVerified × 0.15
 *             + attestationBonus  × 0.05
 */
export function scoreProvenance(input: ProvenanceInput): ProvenanceScore {
  const { source, citation, hashChainVerified, signatureVerified, hasAttestation } = input;

  const sourceTrustScore = computeSourceTrust(source);
  const sourceTrustNormalized = sourceTrustScore / 100;

  const citationScore = citation !== undefined
    ? scoreCitationChain(citation)
    : 0;

  const hashVerified = hashChainVerified ?? false;
  const sigVerified = signatureVerified ?? false;
  const attestation = hasAttestation ?? false;

  const composite =
    sourceTrustNormalized * 0.40 +
    citationScore * 0.25 +
    (hashVerified ? 0.15 : 0) +
    (sigVerified ? 0.15 : 0) +
    (attestation ? 0.05 : 0);

  const score = Math.round(Math.min(1, Math.max(0, composite)) * 1000) / 1000;

  return {
    score,
    level: scoreToLevel(score),
    sourceTrustScore,
    citationVerified: citationScore >= 0.5,
    hashChainVerified: hashVerified,
    signatureVerified: sigVerified,
    hasAttestation: attestation,
    source,
  };
}

/**
 * Quick provenance score for a source with no other metadata.
 */
export function scoreSourceProvenance(source: string): ProvenanceScore {
  return scoreProvenance({ source });
}
