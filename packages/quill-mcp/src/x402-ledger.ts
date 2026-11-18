// SPDX-License-Identifier: AGPL-3.0-only
/**
 * x402 replay-protection ledger (Phase 2).
 *
 * Stores Solana transaction signatures that have been consumed as payment
 * proofs. Once a signature is recorded, it cannot be reused — even if the
 * underlying tx is still valid on-chain.
 *
 * Storage: in-memory Map with optional atomic JSON snapshot at
 * X402_LEDGER_PATH. TTL-based eviction prevents unbounded growth.
 *
 * Multi-node production note: this is single-process. Federation TODO
 * mirrors the quota.ts pattern — eventual migration to Cloudflare KV/D1.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { X402_LEDGER_RETENTION_MS } from './x402-constants.js';

// ─── Types ──────────────────────────────────────────────────────────────

interface LedgerEntry {
  /** First time this signature was seen (ms epoch). */
  firstSeenAt: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────

const PERSIST_DEBOUNCE_MS = 5_000;

function nowMs(): number {
  return Date.now();
}

// ─── Ledger ─────────────────────────────────────────────────────────────

/**
 * Tracks consumed payment signatures.
 *
 * Single-threaded Node guarantee: Map.get → Map.set is atomic w.r.t. V8 ticks
 * (no await between read and write), so concurrent `recordIfNew()` calls
 * cannot interleave to double-record a signature.
 */
export class ReplayLedger {
  private entries = new Map<string, LedgerEntry>();
  private persistPath: string | null;
  private persistTimer: NodeJS.Timeout | null = null;
  private dirty = false;

  constructor(opts?: { persistPath?: string | null }) {
    this.persistPath = opts?.persistPath ?? process.env.X402_LEDGER_PATH ?? null;
    if (this.persistPath) {
      this.load();
    }
  }

  /**
   * Check if a signature has already been used as payment.
   * Returns true if the signature is in the ledger.
   */
  has(signature: string): boolean {
    this.evictIfDue();
    return this.entries.has(signature);
  }

  /**
   * Atomically record a signature if it hasn't been seen before.
   * Returns true if newly recorded (proof is first-use),
   * false if it was already in the ledger (replay attempt blocked).
   */
  recordIfNew(signature: string): boolean {
    this.evictIfDue();
    if (this.entries.has(signature)) return false;
    this.entries.set(signature, { firstSeenAt: nowMs() });
    this.dirty = true;
    this.schedulePersist();
    return true;
  }

  /** Total entries currently tracked. */
  size(): number {
    this.evictIfDue();
    return this.entries.size;
  }

  /** Test helper — wipe all entries (does not persist). */
  reset(): void {
    this.entries.clear();
    this.dirty = false;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
  }

  /** Flush pending writes synchronously (used on SIGTERM). */
  flushSync(): void {
    if (!this.persistPath || !this.dirty) return;
    try {
      mkdirSync(dirname(this.persistPath), { recursive: true });
      const tmp = `${this.persistPath}.tmp`;
      writeFileSync(tmp, JSON.stringify({
        version: 1,
        entries: [...this.entries.entries()],
      }, null, 2));
      renameSync(tmp, this.persistPath);
      this.dirty = false;
    } catch {
      // Best-effort persist — the in-memory ledger is still authoritative
      // for this process lifetime. Restart resilient via load() below.
    }
  }

  // ── private ─────────────────────────────────────────────────────────

  private schedulePersist(): void {
    if (!this.persistPath || this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.flushSync();
    }, PERSIST_DEBOUNCE_MS);
  }

  private load(): void {
    if (!this.persistPath || !existsSync(this.persistPath)) return;
    try {
      const raw = readFileSync(this.persistPath, 'utf-8');
      const parsed = JSON.parse(raw) as { version: number; entries: [string, LedgerEntry][] };
      if (parsed.version !== 1) return;
      this.entries = new Map(parsed.entries);
    } catch {
      // Corrupt ledger — start fresh. Worst case: a previously-consumed
      // signature could be replayed within its TTL. Acceptable for now;
      // a hash-of-amount-scoped index can tighten this later.
      this.entries = new Map();
    }
  }

  /**
   * Drop entries older than X402_LEDGER_RETENTION_MS.
   * Called at the start of every public read/write to keep the
   * eviction cost amortised — no need for a separate timer.
   */
  private evictIfDue(): void {
    const cutoff = nowMs() - X402_LEDGER_RETENTION_MS;
    let removed = 0;
    for (const [sig, entry] of this.entries) {
      if (entry.firstSeenAt < cutoff) {
        this.entries.delete(sig);
        removed++;
      }
    }
    if (removed > 0) this.dirty = true;
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────

let singleton: ReplayLedger | null = null;

export function getReplayLedger(): ReplayLedger {
  if (!singleton) singleton = new ReplayLedger();
  return singleton;
}
