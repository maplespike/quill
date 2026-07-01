/**
 * MapleSpike — PII Hash Helper (Decision 0002)
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
 * The server-side `MAPLESPIKE_PII_HASH_SECRET` env var
 * (auto-generated if absent) salts the HMAC so a database leak does
 * not expose plaintext via rainbow-table attack.
 */

import { createHmac, randomBytes } from "node:crypto";

let _cachedSecret: string | null = null;

function getSecret(): string {
  if (_cachedSecret) return _cachedSecret;
  const env = process.env["MAPLESPIKE_PII_HASH_SECRET"];
  // All environments (dev/staging/prod): enforce a length floor
  // AND a hex-format check so an operator can't accidentally set
  // a 32-char garbage string with weak entropy.
  if (env && /^[0-9a-f]{64}$/i.test(env)) {
    _cachedSecret = env;
    return _cachedSecret;
  }
  if (env && env.length > 0) {
    throw new Error(
      `MAPLESPIKE_PII_HASH_SECRET must be a 64-char hex string (got length=${env.length}). ` +
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
      "MAPLESPIKE_PII_HASH_SECRET must be set to a stable 32-byte hex " +
        "string in production. Refusing to start with an ephemeral secret " +
        "(see Decision 0002 in docs/decisions/0002-pii-avoidance.md).",
    );
  }
  // Dev / test only: auto-generate so the app boots. Hashes WILL
  // drift across restarts; that's expected in dev.
  _cachedSecret = randomBytes(32).toString("hex");
  // eslint-disable-next-line no-console
  console.warn(
    "[pii-hash] MAPLESPIKE_PII_HASH_SECRET was unset; generated an ephemeral secret. " +
      "Hashes will NOT survive a process restart. Set this env var to a 32-byte hex string " +
      "before deploying to production.",
  );
  return _cachedSecret;
}

/**
 * Normalize + hash a PII value (e.g. email) into a stable opaque token.
 *
 *   hashPii("User@Example.COM") === hashPii("user@example.com")
 *
 * Lowercasing + trim keeps the same row for the same canonical user.
 * Use `sha256` so it's short enough to use as a primary key.
 */
export function hashPii(value: string): string {
  const normalized = value.trim().toLowerCase();
  return createHmac("sha256", getSecret()).update(normalized).digest("hex");
}

/**
 * Constant-time comparison for PII-hash matches (avoid timing
 * leaks when looking up by email_hash).
 */
export function matchesPiiHash(plaintext: string, hash: string): boolean {
  const candidate = hashPii(plaintext);
  // Manual constant-time compare — Node has timingSafeEqual but
  // requires equal-length buffers; for a 64-char hex that's safe.
  if (candidate.length !== hash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < candidate.length; i++) {
    mismatch |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return mismatch === 0;
}
