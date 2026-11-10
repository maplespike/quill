// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Pre-pay credit balance ledger (Phase 3).
 *
 * Lets power users pre-fund a credit balance via a single on-chain USDC
 * deposit, then spend it across many tool calls without per-call on-chain
 * verification (reducing latency from ~600ms/RPC to ~0ms/in-memory).
 *
 * Keyed by `QuotaIdentity.hashed`. Persistence follows the same atomic
 * JSON snapshot pattern as quota.ts — single-node MVP, Cloudflare KV/D1
 * for multi-node federation.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { QuotaIdentity } from './quota.js';

// ─── Constants ──────────────────────────────────────────────────────────

const PERSIST_DEBOUNCE_MS = 5_000;

// ─── Types ──────────────────────────────────────────────────────────────

interface CreditEntry {
  /** Available balance in USDC (decimal). */
  balance: number;
  /** Total amount ever deposited (USDC). */
  deposited: number;
  /** Total amount ever spent (USDC). */
  spent: number;
  /** Time of last deposit (ms epoch), null if no deposits yet. */
  lastDepositAt: number | null;
  /** Time of last spend (ms epoch), null if no spends yet. */
  lastSpendAt: number | null;
}

/** Public read-only view. */
export interface CreditStatus {
  identity: string;
  balance: number;
  deposited: number;
  spent: number;
  lastDepositAt: string | null;
  lastSpendAt: string | null;
}

// ─── Ledger ─────────────────────────────────────────────────────────────

/**
 * Manages pre-pay credit balances.
 *
 * Production note: as with quota.ts, Map mutation is atomic within a single
 * Node process (no await between read and write). Multi-instance deployments
 * MUST migrate to Cloudflare KV/D1.
 */
export class CreditStore {
  private entries = new Map<string, CreditEntry>();
  private persistPath: string | null;
  private persistTimer: NodeJS.Timeout | null = null;
  private dirty = false;

  constructor(opts?: { persistPath?: string | null }) {
    this.persistPath = opts?.persistPath ?? process.env.X402_CREDITS_PATH ?? null;
    if (this.persistPath) {
      this.load();
    }
  }

  /** Get the current credit status for an identity (read-only). */
  getStatus(id: QuotaIdentity): CreditStatus {
    const e = this.entries.get(id.hashed) ?? this.emptyEntry();
    return {
      identity: id.label,
      balance: e.balance,
      deposited: e.deposited,
      spent: e.spent,
      lastDepositAt: e.lastDepositAt ? new Date(e.lastDepositAt).toISOString() : null,
      lastSpendAt: e.lastSpendAt ? new Date(e.lastSpendAt).toISOString() : null,
    };
  }

  /**
   * Deposit a USDC amount after successful on-chain verification.
   * Returns the post-deposit status.
   *
   * Negative or non-finite amounts are rejected (no-op).
   */
  deposit(id: QuotaIdentity, amountUsd: number): CreditStatus {
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      // No state change, return current status.
      return this.getStatus(id);
    }
    const existing = this.entries.get(id.hashed) ?? this.emptyEntry();
    existing.balance += amountUsd;
    existing.deposited += amountUsd;
    existing.lastDepositAt = Date.now();
    this.entries.set(id.hashed, existing);
    this.dirty = true;
    this.schedulePersist();
    return this.getStatus(id);
  }

  /**
   * Try to spend amountUsd from the identity's credit balance.
   * Returns true if successful (balance >= amount), false otherwise.
   */
  spend(id: QuotaIdentity, amountUsd: number): boolean {
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return true;
    const existing = this.entries.get(id.hashed);
    if (!existing || existing.balance < amountUsd) return false;

    // Single-threaded Node — read-modify-write is atomic w.r.t. ticks.
    existing.balance -= amountUsd;
    existing.spent += amountUsd;
    existing.lastSpendAt = Date.now();
    this.dirty = true;
    this.schedulePersist();
    return true;
  }

  /** Test helper. */
  reset(): void {
    this.entries.clear();
    this.dirty = false;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
  }

  /** Test helper. */
  size(): number {
    return this.entries.size;
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
      // In-memory remains authoritative.
    }
  }

  // ── private ─────────────────────────────────────────────────────────

  private emptyEntry(): CreditEntry {
    return {
      balance: 0,
      deposited: 0,
      spent: 0,
      lastDepositAt: null,
      lastSpendAt: null,
    };
  }

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
      const parsed = JSON.parse(raw) as { version: number; entries: [string, CreditEntry][] };
      if (parsed.version !== 1) return;
      this.entries = new Map(parsed.entries);
    } catch {
      this.entries = new Map();
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────

let singleton: CreditStore | null = null;

export function getCreditStore(): CreditStore {
  if (!singleton) singleton = new CreditStore();
  return singleton;
}
