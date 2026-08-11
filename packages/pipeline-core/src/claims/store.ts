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

import { canonicalJson, type ClaimBundle } from './index.js';
import { getRawDb } from '@maplespike/database';
import type { Database } from '@maplespike/database';

interface StoredRecord {
  hash: string;
  serialized: string;
  citation_json: string;
  created_at: string;
}

/** Lightweight summary of a claim bundle — enough to index/discover claims without shipping full values. */
export interface RecentClaim {
  hash: string;
  claim: string;
  sourceName: string;
  sourceUrl: string;
  retrievedAt?: string;
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
            bundle: JSON.parse(row.citation_json) as ClaimBundle,
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
      bundle: JSON.parse(mem.citation_json) as ClaimBundle,
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
          const bundle = JSON.parse(row.citation_json) as ClaimBundle;
          records.push({
            hash: row.hash,
            claim: bundle.claim,
            sourceName: bundle.sourceName,
            sourceUrl: bundle.sourceUrl,
            retrievedAt: bundle.retrievedAt,
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
        const bundle = JSON.parse(r.citation_json) as ClaimBundle;
        return {
          hash: r.hash,
          claim: bundle.claim,
          sourceName: bundle.sourceName,
          sourceUrl: bundle.sourceUrl,
          retrievedAt: bundle.retrievedAt,
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
