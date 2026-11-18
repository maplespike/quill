// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — PII Hash Helper (Decision 0002)
 *
 * Storage layers agree on a single HMAC-SHA256 derivation for any PII
 * that *must* be retained only as a lookup token (email, phone, etc.).
 *
 * Plaintext PII NEVER reaches this function from a long-lived
 * variable. Call sites should:
 *   1. Receive the plaintext from request body
 *   2. Hash it immediately to obtain the row key
 *   3. Send the original email via a transactional mailer (one-shot)
 *   4. Discard the plaintext
 *
 * The server-side `QUILL_PII_HASH_SECRET` env var
 * (auto-generated if absent) salts the HMAC so a database leak does
 * not expose plaintext via rainbow-table attack.
 *
 * Dual-key rotation support: an optional `QUILL_PII_HASH_SECRET_PREVIOUS`
 * keeps lookups working for rows written under a retiring secret. Writes
 * always use the primary. See docs/decisions/0002-pii-avoidance.md
 * ("Rotation & dual-key support").
 */

import { createHmac, randomBytes } from "node:crypto";

let _cachedSecret: string | null = null;
let _cachedSecretRaw: string | undefined;
let _cachedPrevious: string | null = null;
let _cachedPreviousRaw: string | undefined;
let _previousWarned = false;

function getSecret(): string {
  const env = process.env["QUILL_PII_HASH_SECRET"];
  if (_cachedSecret && _cachedSecretRaw === env) return _cachedSecret;
  // All environments (dev/staging/prod): enforce a length floor
  // AND a hex-format check so an operator can't accidentally set
  // a 32-char garbage string with weak entropy.
  if (env && /^[0-9a-f]{64}$/i.test(env)) {
    _cachedSecret = env;
    _cachedSecretRaw = env;
    return _cachedSecret;
  }
  if (env && env.length > 0) {
    throw new Error(
      `QUILL_PII_HASH_SECRET must be a 64-char hex string (got length=${env.length}). ` +
        "Decision 0002 refuses shorter or non-hex secrets in any environment to keep `emailHash` " +
        "namespaces reconcilable across restart, staging, and production.",
    );
  }
  // Production safety (Decision 0002): refuse to start without a
  // stable secret. An ephemeral secret would silently invalidate
  // every existing tenant's `emailHash` lookup on every restart,
  // breaking the verified-email branch invisibly.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "QUILL_PII_HASH_SECRET must be set to a stable 32-byte hex " +
        "string in production. Refusing to start with an ephemeral secret " +
        "(see Decision 0002 in docs/decisions/0002-pii-avoidance.md).",
    );
  }
  // Dev / test only: auto-generate so the app boots. Hashes WILL
  // drift across restarts; that's expected in dev.
  _cachedSecret = randomBytes(32).toString("hex");
  _cachedSecretRaw = env;
  console.warn(
    "[pii-hash] QUILL_PII_HASH_SECRET was unset; generated an ephemeral secret. " +
      "Hashes will NOT survive a process restart. Set this env var to a 32-byte hex string " +
      "before deploying to production.",
  );
  return _cachedSecret;
}

/**
 * Retiring secret for dual-key rotation (optional). Absent or empty means
 * single-key mode. A malformed value is ignored (loudly) rather than fatal:
 * an operator typo must not take the API down mid-rotation.
 */
function getPreviousSecret(): string | null {
  const env = process.env["QUILL_PII_HASH_SECRET_PREVIOUS"];
  if (_cachedPreviousRaw === env) return _cachedPrevious;
  _cachedPreviousRaw = env;
  if (!env) {
    _cachedPrevious = null;
    return null;
  }
  if (/^[0-9a-f]{64}$/i.test(env)) {
    _cachedPrevious = env;
    return _cachedPrevious;
  }
  if (!_previousWarned) {
    _previousWarned = true;
    console.error(
      "[pii-hash] QUILL_PII_HASH_SECRET_PREVIOUS is set but is not a 64-char hex string; " +
        "ignoring it. Lookups of hashes written under a previous secret will miss until it is fixed.",
    );
  }
  _cachedPrevious = null;
  return null;
}

function hashWith(secret: string, value: string): string {
  const normalized = value.trim().toLowerCase();
  return createHmac("sha256", secret).update(normalized).digest("hex");
}

/**
 * Normalize + hash a PII value (e.g. email) into a stable opaque token.
 *
 *   hashPii("User@Example.COM") === hashPii("user@example.com")
 *
 * Lowercasing + trim keeps the same row for the same canonical user.
 * Use `sha256` so it's short enough to use as a primary key.
 *
 * WRITE path: always the primary (current) secret.
 */
export function hashPii(value: string): string {
  return hashWith(getSecret(), value);
}

/**
 * All acceptable hashes for a plaintext value, primary first: the current
 * secret's hash plus (when configured) the previous secret's hash. Use this
 * for READ paths so rows written before a rotation remain findable.
 */
export function hashPiiCandidates(value: string): string[] {
  const primary = hashWith(getSecret(), value);
  const previousSecret = getPreviousSecret();
  if (!previousSecret) return [primary];
  const previous = hashWith(previousSecret, value);
  return previous === primary ? [primary] : [primary, previous];
}

/** Manual constant-time compare — Node's timingSafeEqual needs equal-length buffers. */
function slowEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Constant-time comparison for PII-hash matches (avoid timing
 * leaks when looking up by email_hash). Accepts hashes written under
 * either the current or the previous secret.
 */
export function matchesPiiHash(plaintext: string, hash: string): boolean {
  return hashPiiCandidates(plaintext).some((candidate) => slowEquals(candidate, hash));
}
