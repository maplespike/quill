// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Challenge Store (in-memory with TTL)
 *
 * Used by Web3 (SIWE) and Passkey (WebAuthn) auth flows.
 * Stores nonces/challenges temporarily for verification.
 * 5-minute TTL, automatically pruned on access.
 */

const CHALLENGE_TTL = 5 * 60 * 1000; // 5 minutes
const PRUNE_INTERVAL = 60 * 1000; // Prune every minute

interface ChallengeEntry {
  challenge: string;
  address?: string;
  createdAt: number;
}

const store = new Map<string, ChallengeEntry>();

let lastPrune = Date.now();

function prune(): void {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL) return;
  lastPrune = now;
  for (const [key, entry] of store) {
    if (now - entry.createdAt > CHALLENGE_TTL) {
      store.delete(key);
    }
  }
}

export function setChallenge(key: string, challenge: string, address?: string): void {
  prune();
  store.set(key, { challenge, address, createdAt: Date.now() });
}

export function getChallenge(key: string): ChallengeEntry | null {
  prune();
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CHALLENGE_TTL) {
    store.delete(key);
    return null;
  }
  return entry;
}

export function consumeChallenge(key: string): ChallengeEntry | null {
  const entry = getChallenge(key);
  if (entry) store.delete(key); // One-time use
  return entry;
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
