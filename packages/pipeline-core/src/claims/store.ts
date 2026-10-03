// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * CitationStore — persistent content-addressable claim store
 *
 * SQLite-backed (via @maplespike/database getRawDb) with an in-memory
 * fallback for zero-DB modes (stdio `npx` without a database file).
 * This is the storage half of the Claim Stack: tools register bundles on
 * every response, and get_citation / verify_claim / /v1/citation look them up
 * by SHA-256.
 */

import { canonicalJson, buildProvenanceEvidence, type ClaimBundle } from './index.js';
import { redactArtifactUrl } from './evidence.js';
import type { ClaimProvenanceEvidence } from './types.js';
import { getRawDb } from '@maplespike/database';
import type { Database } from '@maplespike/database';

interface StoredRecord {
  hash: string;
  serialized: string;
  citation_json: string;
  created_at: string;
}

/** Normalize stored claim JSON without treating its registration time as source retrieval. */
function decodeClaimBundle(value: unknown, hash: string): ClaimBundle {
  const bundle = value as ClaimBundle & { provenanceEvidence?: ClaimProvenanceEvidence };
  const storedEvidence = bundle.provenanceEvidence as (ClaimProvenanceEvidence | undefined) & {
    acquisition?: { artifacts?: Array<Record<string, unknown>> };
  };
  let provenanceEvidence: ClaimProvenanceEvidence;
  if (storedEvidence?.schema_version === 'quill.provenance.v1') {
    // Preserve evidence-source distinctions (including request captures, which
    // are intentionally not duplicated in sourceArtifactsEvidence).
    const artifacts = (storedEvidence.acquisition?.artifacts ?? []).flatMap(raw => {
      const evidenceSource: 'shared-http-client-capture' | 'explicit-record-evidence' =
        raw.evidence_source === 'shared-http-client-capture'
          ? 'shared-http-client-capture'
          : 'explicit-record-evidence';
      const hashScope: 'http-client-response-body-utf8' | null =
        raw.hash_scope === 'http-client-response-body-utf8'
          || raw.hash_scope === 'http-client-response-body-bytes'
          ? 'http-client-response-body-utf8'
          : null;
      const bodyCapture = raw.body_capture === 'complete-http-client-body'
        || raw.body_capture === 'empty-body-not-captured'
        ? raw.body_capture
        : null;
      const safeUrl = typeof raw.url === 'string'
        ? redactArtifactUrl(raw.url, raw.url_redacted === true)
        : null;
      if (!safeUrl || typeof raw.retrieved_at !== 'string'
        || !Number.isFinite(Date.parse(raw.retrieved_at))
        || typeof raw.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(raw.sha256)
        || !Number.isInteger(raw.status_code) || raw.status_code < 0 || raw.status_code > 599
        || (raw.byte_length !== null && raw.byte_length !== undefined
          && (!Number.isInteger(raw.byte_length) || (raw.byte_length as number) < 0))
        || !bodyCapture || !hashScope) return [];
      const association: 'url-matched-not-content-verified' | 'not-established' =
        raw.association === 'url-matched-not-content-verified'
          ? 'url-matched-not-content-verified'
          : 'not-established';
      return [{
        ...raw,
        url: safeUrl.url,
        url_redacted: safeUrl.urlRedacted,
        association,
        evidence_source: evidenceSource,
        hash_scope: hashScope,
        sha256: raw.sha256.toLowerCase(),
        body_capture: bodyCapture,
      }];
    });
    const associated = artifacts.some(artifact => artifact.association === 'url-matched-not-content-verified');
    provenanceEvidence = {
      ...storedEvidence,
      record_integrity: {
        ...storedEvidence.record_integrity,
        digest: hash,
      },
      acquisition: {
        ...storedEvidence.acquisition,
        status: artifacts.length ? 'captured' : 'not-captured',
        association: associated ? 'url-matched-not-content-verified' : artifacts.length ? 'not-established' : 'none',
        artifacts,
      },
    };
  } else {
    // Legacy bundles may carry record-supplied artifact metadata, but a legacy
    // retrievedAt field alone cannot establish when the source was acquired.
    const normalizedEvidence = buildProvenanceEvidence(hash, {
      ...bundle,
      sourceArtifactsEvidence: Array.isArray(bundle.sourceArtifactsEvidence)
        ? bundle.sourceArtifactsEvidence
        : [],
    });
    provenanceEvidence = normalizedEvidence;
  }
  const evidencedRetrievalTime = provenanceEvidence.acquisition.artifacts
    .find(artifact => artifact.association === 'url-matched-not-content-verified')?.retrieved_at;
  const safeSourceUrl = redactArtifactUrl(bundle.sourceUrl)?.url ?? bundle.sourceUrl;
  const safeLicenseUrl = bundle.licenseUrl
    ? redactArtifactUrl(bundle.licenseUrl)?.url ?? bundle.licenseUrl
    : undefined;
  const safePublisherTermsEvidence = bundle.publisherTermsEvidence
    ? {
        ...bundle.publisherTermsEvidence,
        ...(bundle.publisherTermsEvidence.url
          ? { url: redactArtifactUrl(bundle.publisherTermsEvidence.url)?.url ?? bundle.publisherTermsEvidence.url }
          : {}),
      }
    : undefined;
  return {
    ...bundle,
    sourceUrl: safeSourceUrl,
    ...(safeLicenseUrl ? { licenseUrl: safeLicenseUrl } : {}),
    ...(safePublisherTermsEvidence ? { publisherTermsEvidence: safePublisherTermsEvidence } : {}),
    retrievedAt: evidencedRetrievalTime,
    provenanceEvidence,
  };
}

/** Lightweight summary of a claim bundle — enough to index/discover claims without shipping full values. */
export interface RecentClaim {
  hash: string;
  claim: string;
  sourceName: string;
  sourceUrl: string;
  retrievedAt: string | null;
  license?: string;
  updateFrequency?: string;
  createdAt: string;
}

/** Ensure the citation_records table exists (idempotent). */
export const CITATION_RECORDS_DDL = `
CREATE TABLE IF NOT EXISTS citation_records (
  hash TEXT PRIMARY KEY,
  serialized TEXT NOT NULL,
  citation_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

let sqlite: Database | null = null;

/** Lazily open the shared SQLite handle (mirrors entity-resolver-lib). */
function getSqlite(): Database | null {
  try {
    if (!sqlite) {
      sqlite = getRawDb();
      sqlite.exec(CITATION_RECORDS_DDL);
    }
    return sqlite;
  } catch {
    return null; // no database available — caller falls back to memory
  }
}

export class CitationStore {
  private memory = new Map<string, StoredRecord>();

  /** Persist a claim bundle. */
  put(bundle: ClaimBundle): void {
    // Must persist the SAME canonical serialization that was hashed —
    // buildClaimBundle hashes canonicalJson(value), so round-tripping
    // verification requires canonicalJson here too.
    const serialized = canonicalJson(bundle.value ?? null);
    const citationJson = JSON.stringify(bundle);
    const record: StoredRecord = {
      hash: bundle.sha256,
      serialized,
      citation_json: citationJson,
      created_at: new Date().toISOString(),
    };

    const db = getSqlite();
    if (db) {
      try {
        db.prepare(
          `INSERT OR IGNORE INTO citation_records (hash, serialized, citation_json, created_at)
           VALUES (?, ?, ?, ?)`,
        ).run(record.hash, record.serialized, record.citation_json, record.created_at);
        return;
      } catch {
        // fall through to memory
      }
    }
    this.memory.set(record.hash, record);
  }

  /** Look up a stored bundle by its SHA-256 hex hash. */
  get(hash: string): { bundle: ClaimBundle; serialized: string; createdAt: string } | undefined {
    const clean = hash.toLowerCase().replace(/^sha256[:\-]/, '');

    const db = getSqlite();
    if (db) {
      try {
        const row = db.prepare(
          'SELECT hash, serialized, citation_json, created_at FROM citation_records WHERE hash = ?',
        ).get(clean) as StoredRecord | undefined;
        if (row) {
          return {
            bundle: decodeClaimBundle(JSON.parse(row.citation_json), row.hash),
            serialized: row.serialized,
            createdAt: row.created_at,
          };
        }
      } catch {
        // fall through to memory
      }
    }

    const mem = this.memory.get(clean);
    if (!mem) return undefined;
    return {
      bundle: decodeClaimBundle(JSON.parse(mem.citation_json), mem.hash),
      serialized: mem.serialized,
      createdAt: mem.created_at,
    };
  }

  /** Check whether a hash is present. */
  has(hash: string): boolean {
    return this.get(hash) !== undefined;
  }

  /**
   * Most recently registered claim bundles, newest first.
   * Merges SQLite + memory backends (deduped by hash) and returns
   * lightweight summaries — enough to render an index of discoverable
   * claims without shipping full values over the wire.
   */
  latest(limit = 25): RecentClaim[] {
    const records: RecentClaim[] = [];
    const db = getSqlite();
    if (db) {
      try {
        // Deterministic order: created_at desc, then hash desc — batches
        // register many bundles within the same millisecond, so a hash
        // tie-break keeps the index stable across runs.
        const rows = db.prepare(
          `SELECT hash, citation_json, created_at FROM citation_records
           ORDER BY created_at DESC, hash DESC LIMIT ?`,
        ).all(limit) as Array<{ hash: string; citation_json: string; created_at: string }>;
        for (const row of rows) {
          const bundle = decodeClaimBundle(JSON.parse(row.citation_json), row.hash);
          records.push({
            hash: row.hash,
            claim: bundle.claim,
            sourceName: bundle.sourceName,
            sourceUrl: bundle.sourceUrl,
            retrievedAt: bundle.retrievedAt ?? null,
            license: bundle.license,
            updateFrequency: bundle.updateFrequency,
            createdAt: row.created_at,
          });
        }
      } catch { /* memory only */ }
    }

    // Merge memory records (dedupe by hash; memory is a fallback when the DB
    // write failed — never a source of truth, so DB rows win on ties).
    const seen = new Set(records.map((r) => r.hash));
    const memRecords = Array.from(this.memory.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.hash.localeCompare(a.hash))
      .filter((r) => !seen.has(r.hash))
      .slice(0, Math.max(0, limit - records.length))
      .map((r) => {
        const bundle = decodeClaimBundle(JSON.parse(r.citation_json), r.hash);
        return {
          hash: r.hash,
          claim: bundle.claim,
          sourceName: bundle.sourceName,
          sourceUrl: bundle.sourceUrl,
          retrievedAt: bundle.retrievedAt ?? null,
          license: bundle.license,
          updateFrequency: bundle.updateFrequency,
          createdAt: r.created_at,
        };
      });

    return records.concat(memRecords).slice(0, limit);
  }

  /** All stored hashes. */
  keys(): string[] {
    const keys = new Set<string>();
    for (const k of this.memory.keys()) keys.add(k);
    const db = getSqlite();
    if (db) {
      try {
        const rows = db.prepare('SELECT hash FROM citation_records').all() as { hash: string }[];
        for (const r of rows) keys.add(r.hash);
      } catch { /* memory only */ }
    }
    return Array.from(keys);
  }

  /** Number of stored records. */
  get size(): number {
    return this.keys().length;
  }

  /** Clear the store (both backends). */
  clear(): void {
    this.memory.clear();
    const db = getSqlite();
    if (db) {
      try {
        db.exec('DELETE FROM citation_records');
      } catch { /* memory only */ }
    }
  }
}

/** Shared singleton — tools register and verify against this instance. */
export const citationStore = new CitationStore();
