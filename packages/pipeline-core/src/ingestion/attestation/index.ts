// SPDX-License-Identifier: AGPL-3.0-only
/**
 * MapleSpike Attestation & Provenance
 *
 * Five-layer integrity system:
 *   1. Citation envelope — SHA-256 hash + source + license + timestamp
 *   2. Update frequency — per-module refresh schedule
 *   3. Merkle tree — batch-verify all records in a pipeline run
 *   4. Ed25519 signatures — cryptographic attestation over the merkle root
 *   5. Content-addressable storage — store/retrieve by hash
 */

import { computeHash } from '../../verification/hashing.js';
import { NO_REUSE_LICENSE_NOTICE } from '../../shared/attribution.js';
import type { LicenseMetadataBasis } from '../../shared/attribution.js';

/* ------------------------------------------------------------------ */
/*  1. UNIFIED CITATION ENVELOPE                                       */
/* ------------------------------------------------------------------ */

/** Citation envelope attached to records that a module chooses to attest; not every record or response carries one */
export interface Citation {
  /** Human-readable source name (e.g. "open.canada.ca") */
  sourceName: string;
  /** Direct URL to the upstream government data */
  sourceUrl: string;
  /** Publisher-declared source/dataset terms, or a precise notice that metadata did not declare a license. */
  license: string;
  licenseUrl?: string;
  licenseBasis?: LicenseMetadataBasis;
  attributionText?: string;
  /** SHA-256 hash of the serialized record content */
  dataHash: string;
  /** ISO-8601 timestamp of when we retrieved the data */
  retrievedAt: string;
  /** Expected update cadence (e.g. "monthly", "daily", "realtime") */
  updateFrequency: string;
  /** Language of the source data: 'en', 'fr', or 'both' */
  lang?: string;
  /** Merkle tree root hash for this pipeline run (optional) */
  merkleRoot?: string;
  /** Ed25519 signature over `dataHash + sourceUrl + retrievedAt` (optional) */
  signature?: string;
  /** Public key fingerprint that can verify the signature */
  signerKeyId?: string;
}

/** Build a Citation envelope for a single record */
export function buildCitation(params: {
  sourceName: string;
  sourceUrl: string;
  dataHash: string;
  updateFrequency?: string;
  license?: string;
  licenseUrl?: string;
  licenseBasis?: LicenseMetadataBasis;
  attributionText?: string;
}): Citation {
  return {
    sourceName: params.sourceName,
    sourceUrl: params.sourceUrl,
    license: params.license?.trim() || NO_REUSE_LICENSE_NOTICE,
    licenseUrl: params.licenseUrl,
    licenseBasis: params.licenseBasis ?? 'no-publisher-declaration',
    attributionText: params.attributionText ?? NO_REUSE_LICENSE_NOTICE,
    dataHash: params.dataHash,
    retrievedAt: new Date().toISOString(),
    updateFrequency: params.updateFrequency ?? 'unknown',
  };
}

/* ------------------------------------------------------------------ */
/*  2. UPDATE FREQUENCY MAP                                            */
/* ------------------------------------------------------------------ */

/** Canonical update cadences per module */
export const UPDATE_FREQUENCIES: Record<string, string> = {
  // Real-time / high frequency
  'realtime': 'realtime',
  'eccc-weather-alerts': 'realtime',
  'cbsa-border-wait-times': 'realtime',
  'ngo-rss': 'realtime',
  'media-rss': 'realtime',

  // Daily
  'committees': 'daily',
  'gazette': 'daily',

  // Weekly
  'canlii': 'weekly',
  'canlii-fr': 'weekly',
  'legisquebec': 'event-driven',
  'gazette-fr': 'daily',
  'statcan-fr': 'monthly',
  'quebec-city-data': 'monthly',
  'montreal-data': 'monthly',
  'a2aj': 'weekly',

  // Monthly
  'immigration': 'monthly',
  'lmia': 'monthly',
  'ircc': 'monthly',
  'cbsa': 'monthly',
  'gic': 'monthly',
  'elections': 'monthly',
  'proactive-disclosure': 'monthly',
  'corporate': 'monthly',
  'influence': 'monthly',
  'lobbying': 'monthly',
  'sedi': 'monthly',
  'indigenous': 'monthly',
  'criminal-justice': 'monthly',
  'defence': 'monthly',
  'veterans': 'monthly',
  'health-canada': 'monthly',
  'health-data': 'monthly',
  'education': 'monthly',
  'social-programs': 'monthly',
  'science': 'monthly',
  'cipo': 'monthly',
  'cmhc': 'monthly',
  'cra-charity': 'monthly',
  'crown-corporations': 'monthly',
  'crtc': 'monthly',
  'federal-budget': 'monthly',
  'npri': 'monthly',
  'species-at-risk': 'monthly',
  'impact-assessment': 'monthly',
  'ati': 'monthly',
  'municipal': 'monthly',
  'provincial-legislatures': 'monthly',
  'provincial-lobbying': 'monthly',
  'oversight': 'monthly',
  'bank-of-canada': 'monthly',
  'geospatial': 'monthly',

  // Quarterly
  'statcan': 'quarterly',
  'transport': 'quarterly',
  'tsb': 'quarterly',

  // Annually
  'federal-budget-annual': 'yearly',
  'agri-fisheries': 'yearly',
  'culture': 'yearly',

  // On legislation change (infrequent)
  'legislation': 'event-driven',
  'justice-canada-xml': 'event-driven',
  'a2aj-laws': 'event-driven',
};

/** Get the update frequency for a module */
export function getUpdateFrequency(moduleName: string): string {
  return UPDATE_FREQUENCIES[moduleName] ?? 'unknown';
}

/* ------------------------------------------------------------------ */
/*  3. MERKLE TREE (batch verification)                                */
/* ------------------------------------------------------------------ */

/**
 * Build a Merkle tree from a list of record hashes.
 * Returns the root hash that commits to all records.
 *
 * Tree structure:
 *   leaves = hashes (padded to power of 2)
 *   level 1 = hash(leaf0 + leaf1), hash(leaf2 + leaf3), ...
 *   root = final hash at top
 */
export async function buildMerkleRoot(recordHashes: string[]): Promise<{
  root: string;
  tree: string[][];
}> {
  if (recordHashes.length === 0) {
    const empty = await computeHash('maplespike:empty', 'sha256');
    return { root: empty, tree: [[empty]] };
  }

  // Build tree bottom-up
  const tree: string[][] = [recordHashes];
  let current = recordHashes;

  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        next.push(await computeHash(current[i] + current[i + 1], 'sha256'));
      } else {
        next.push(current[i]); // Odd node carries up
      }
    }
    tree.push(next);
    current = next;
  }

  return { root: current[0], tree };
}

/**
 * Generate a Merkle proof for a specific leaf hash.
 * Returns the sibling hashes needed to reconstruct the root.
 */
export function generateMerkleProof(
  leafHash: string,
  tree: string[][],
): { index: number; siblings: string[] } | null {
  for (let level = 0; level < tree.length - 1; level++) {
    const leaves = tree[level];
    const idx = leaves.indexOf(leafHash);
    if (idx !== -1) {
      const siblings: string[] = [];
      let currentIdx = idx;
      for (let l = level; l < tree.length - 1; l++) {
        const pair = currentIdx % 2 === 0
          ? tree[l][currentIdx + 1]
          : tree[l][currentIdx - 1];
        if (pair) siblings.push(pair);
        currentIdx = Math.floor(currentIdx / 2);
      }
      return { index: idx, siblings };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  4. ED25519 SIGNED ATTESTATIONS                                     */
/* ------------------------------------------------------------------ */

/**
 * Sign a citation envelope with an Ed25519 key.
 * The signature covers: dataHash + sourceUrl + retrievedAt
 *
 * Requires a CryptoKeyPair from Web Crypto API.
 * Fallback: returns null if Web Crypto Ed25519 is unavailable.
 */
export async function signCitation(
  citation: Citation,
  privateKey: CryptoKey,
): Promise<string | null> {
  try {
    const message = new TextEncoder().encode(
      citation.dataHash + citation.sourceUrl + citation.retrievedAt,
    );
    const signature = await crypto.subtle.sign(
      { name: 'Ed25519' },
      privateKey,
      message,
    );
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // Ed25519 not available in this runtime
    return null;
  }
}

/**
 * Verify an Ed25519 signature over a citation envelope.
 */
export async function verifyCitationSignature(
  citation: Citation,
  publicKey: CryptoKey,
): Promise<boolean> {
  if (!citation.signature) return false;
  try {
    const message = new TextEncoder().encode(
      citation.dataHash + citation.sourceUrl + citation.retrievedAt,
    );
    const sigBytes = new Uint8Array(
      citation.signature.match(/.{1,2}/g)!.map(b => parseInt(b, 16)),
    );
    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      publicKey,
      sigBytes,
      message,
    );
  } catch {
    return false;
  }
}

/**
 * Generate an Ed25519 key pair for signing attestations.
 * Stores the public key fingerprint in the returned keyId.
 */
export async function generateAttestationKey(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  keyId: string;
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify'],
  );
  const pubKeyBytes = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const keyId = await computeHash(
    Array.from(new Uint8Array(pubKeyBytes)).map(b => b.toString(16).padStart(2, '0')).join(''),
    'sha256',
  );
  return { ...keyPair, keyId: keyId.slice(0, 16) };
}

/* ------------------------------------------------------------------ */
/*  5. CONTENT-ADDRESSABLE STORAGE MOCK (in-memory)                   */
/* ------------------------------------------------------------------ */

/**
 * Simple content-addressable store: records indexed by SHA-256 hash.
 * In production, this would be backed by SQLite or S3.
 */
export class ContentAddressableStore {
  private store = new Map<string, { data: unknown; citation: Citation }>();

  /** Store a record, keyed by its SHA-256 hash */
  async put(record: unknown, citation: Citation): Promise<string> {
    const serialized = JSON.stringify(record);
    const hash = await computeHash(serialized, 'sha256');
    this.store.set(hash, { data: record, citation });
    return hash;
  }

  /** Retrieve a record by its hash */
  get(hash: string): { data: unknown; citation: Citation } | undefined {
    return this.store.get(hash);
  }

  /** Check if a hash exists */
  has(hash: string): boolean {
    return this.store.has(hash);
  }

  /** Get all stored hashes */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /** Number of stored records */
  get size(): number {
    return this.store.size;
  }

  /** Clear the store */
  clear(): void {
    this.store.clear();
  }
}
