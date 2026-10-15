# Decision 0002 — PII Avoidance (Never Retain PII)

**Status:** Accepted ✅ · **Owner:** TBD · **Date:** 2026-07-01

## Context

The user has directed: **"WE WANT SPECIFICALLY AND EVERY THOUROUGHLY TO
NEVER RETAIN USER/CUSTOMER DATAA"** — clarified to mean **PII**
(Personally Identifiable Information). Auth tokens, opaque IDs, public
wallet addresses, and content hashes are *not* PII and may be retained.

A surface map of the MapleSpike stack found real PII today:

- `tenants.email` column (api-server, sqlite + node-sqlite + D1 + Postgres
  + sqlite-storage drizzle schema) — plaintext email persists.
- `tenants.name` — display name string.
- `notification_subscriptions.email` — plaintext.
- `payment_reconciliations.sender_email` — sender email preserved.
- `IMAP polling` for e-Transfer (etransfer.ts) — *full email bodies* are
  pulled into Maplespike memory.
- `register.ts / validation.ts` — accepts and validates plaintext `email`.
- `auth.ts JWT fallback` — falls back to `payload.email` for tenant
  name; if a misconfigured issuer hands us a JWT with an email claim,
  that email becomes a tenant display string.
- `auth/users.ts` — `emailIndex: Map<email,userId>` builds a reverse
  lookup that lets anyone with INSERT access reconstruct every user's
  email.
- `routes/contact.ts` — accepts name + email + message and emails them
  to us.
- `@convex-dev/auth` (`maplespike-brand`) — the emailOTP provider
  sends mail and persists email plus name + image in Convex.
- `astral-key/src/api/handlers/user.rs` — `UpdateUserRequest.email`
  field, even though no caller currently uses it.

The risks: regulatory exposure (PIPEDA/GDPR breach notification costs),
reputational damage if a backup is stolen, and double-customer
attribution across surfaces. None of these are acceptable because
MapleSpike can run with *zero* PII retention if we architect for it.

## Decision

**MapleSpike NEVER retains PII.** Concretely:

1. **Storage**: any column / row whose value is, derives from, or
   routes an individual is renamed `-→email_hash` (HMAC-SHA256 with a
   server-side secret) or dropped. The plaintext exists only
   transiently — in the request body, in the email send, in the
   bank's webhook — never in our row.
2. **Auth**: identity is rooted in **Astral-key** (SIWE wallet address
   or FIDO2 passkey public key). JWT claims carry `sub` only. The
   `email` claim is read once at token issue for the optional
   `email_verified` flag, then discarded.
3. **e-Transfer reconciliation**: drop IMAP. Replace with a
   memo-keyed Stripe (or Plaid CA) webhook that returns `{ order_id,
   amount, status }` from the bank — sender never enters our backend.
4. **Brand portal**: drop `@convex-dev/auth` emailOTP. Replace with
   Astral-key OIDC; the Convex `users` table becomes `tokenIdentifier`
   only (OIDC `sub`).
5. **Astral-key**: drop `UpdateUserRequest.email`; add std OIDC
   endpoints (`/.well-known/openid-configuration`, `/jwks.json`) so
   any service can verify our tokens without our PII.

## Implementation Notes

- A single `hashPII(value: string)` helper (`HMAC-SHA256(secret,
  value.toLowerCase().trim())`) lives at
  `packages/api-server/src/auth/pii-hash.ts` so storage layers agree.
- Plaintext `email` columns keep their schema name for *one* more
  minor (`0.6.x`) release, then are removed by migration in `0.7.0`.
- Convex auth.ts is deprecated but still importable to give
  consumers a deprecation window (warning emitted on import).
- OIDC client in `maplespike-brand` is `oidc-client-ts` (PKCE +
  refresh + standard discovery).
- All changes flow through this ADR; any new PII column must add a
  justification section here or be rejected at review.

## Consequences

- ✔ Maplespike can answer "what PII do you hold about me?" with
  "none" — verifiable by database inspection.
- ✔ Backup / leak blast radius is bounded to opaque IDs and content
  hashes; no notifiable breach under PIPEDA §10(1).
- ✔ Customer can self-host and audit in 1 command
  (`grep -ri 'email' packages/`).
- ⚠ Astral-key becomes a hard dependency for any auth flow. Mitigated
  by self-hosting the Astral-key NixOS module.
- ⚠ `Maplespike.contact` form (HTML page) needs to be removed or
  post-transform.

## Open Questions

- Should we add a `QUILL_PII_HASH_SECRET` rotation policy? (every
  90d? on compromise?)
- Does it make sense to keep IMAP e-Transfer as **opt-in** for
  non-PIPEDA jurisdictions?

## Rotation & dual-key support (2026-10-15)

`QUILL_PII_HASH_SECRET` is now rotatable without invalidating existing
`emailHash` rows:

1. **One window:** set `QUILL_PII_HASH_SECRET_PREVIOUS` to the retiring
   value and `QUILL_PII_HASH_SECRET` to the new value, then restart the API.
   Reads (`hashPiiCandidates`) accept either secret; writes always use the
   new one.
2. **A rehash is impossible by design** — plaintext is discarded at write
   time, so existing rows cannot be migrated to the new secret. Keep the
   previous secret staffed until no rows carry its hashes. Never rotate
   without setting `_PREVIOUS` in the same change: without it, lookups of
   pre-rotation rows miss.
3. The previous value is delivered from BSM
   (`maplespike-secrets.pii-hash-secret-previous`) through the optional
   `QUILL_PII_HASH_SECRET_PREVIOUS` chart ref; absent means single-key mode.
   A malformed value is ignored and logged, never fatal.

## References

- Decision 0001 (`IDENTITY.md`) — Canonical Identity Path → goes
  well with this ADR.
- PIPEDA §10 — Breach notification.
- GDPR Art. 5(1)(c) — Data minimization.
- `automate.sh` PR — applies this decision to automation.
