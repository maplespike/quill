// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Citation Verification — Quill
 *
 * SHA-256 content hashing for article verification and provenance tracking.
 * Enables third parties to independently verify that content hasn't been altered.
 *
 * Origin: cloudflare/worker/src/index.ts (lines 649-742), cloudflare/schema.sql (citation_hashes table)
 */

/* ------------------------------------------------------------------ */
/*  Crypto (works in Workers, Node 18+, Bun, Deno)                    */
/* ------------------------------------------------------------------ */

/**
 * Compute SHA-256 hash of content.
 * Uses the Web Crypto API — works in all modern runtimes.
 */
export async function computeHash(content: string, algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  // Web Crypto API uses uppercase-with-dash names; Node and browser both
  const algoName = algorithm === 'sha256' ? 'SHA-256'
    : algorithm === 'sha384' ? 'SHA-384'
    : 'SHA-512';
  const hashBuffer = await crypto.subtle.digest(algoName, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify that content matches an expected hash.
 */
export async function verifyHash(content: string, expected: string, algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'): Promise<boolean> {
  const computed = await computeHash(content, algorithm);
  return computed === expected;
}

/**
 * Generate a shell command that lets anyone verify an article's content.
 */
export function generateVerifyCommand(url: string, algorithm: string = 'sha256'): string {
  return `echo -n "$(curl -s '${url}')" | ${algorithm}sum`;
}

/* ------------------------------------------------------------------ */
/*  Verification Record                                                */
/* ------------------------------------------------------------------ */

export interface CitationRecord {
  articleId: number;
  contentHash: string;
  algorithm: string;
  hashLength: number;
  computedAt: string;
  verifiedCount: number;
  lastVerifiedAt: string | null;
}
