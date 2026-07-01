# Decision 0001 — Canonical Identity Path

**Status:** Proposed ⏳ · **Owner:** TBD · **Date:** 2026-07-01

## Context

MapleSpike has four surfaces, each with (or planning) its own identity:

- **Brand site** (`maplespike-brand`) — Convex auth framework
- **MapleSpike Fabric** (live, edge-worker hyperscale) — server-side
  sessions, API-keyed by `?api_key=`
- **Mosiac** (in design) — Ed25519 + passkey per the original DESIGN.md
- **Social Bridge** (in design) — OAuth per platform (Bluesky atproto,
  Mastodon OAuth, etc.)

Without a single canonical identity, the costs are:

- Customer doubling — one person = three accounts (brand, API, Chat).
  Each surface owns its own user table.
- Billing drift — billing/plan-payment lives in brand side; enterprises
  pay via Fabric; Mosiac users pay via a third path. Revenue is hard
  to attribute to actual users.
- Audit gaps — "who did what" evidence is scattered across three
  identity systems that don't cross-reference.

We need one canonical identity every surface speaks to, with opt-in
sovereignty so Mosiac users retain self-custody.

## Options Considered

### A. Centralized-Convex identity (status quo)
Single identity provider; Convex for the brand + Fabric; Mosiac
becomes an OAuth-style client.

- Pro: Simple. Already in place. One sign-in for everything.
- Con: Sovereignty users in Mosiac have to trust Convex. No portable
  identity. Hostile to "sovereignty by design."

### B. Mosiac Ed25519 identity, deferred Convex bridge
Mosiac owns the identity layer first; everyone else becomes a client.

- Pro: Sovereignty-first. Portable. PLC-compatible.
- Con: Convex auth + Mosiac must interop → duplicate-account risk
  for cross-surface users. None of the brand or Fabric tooling
  speaks Ed25519 yet.

### C. Hybrid — Mosiac owns keys, Convex-friendly bridge
Mosiac issues Ed25519 + passkey at signup. A "Convex-friendly"
projection (a stable user id) is derived and cached in Convex for
the brand portal. Fabric keys either by the same Mosiac key (future)
or fall back to API keys for non-Mosiac users.

- Pro: Sovereignty by default. Convex ergonomics when the user
  chooses brand-side conveniences. Reconciles "who is this person"
  without forcing a single shape.
- Con: Two layers to maintain. Phase 1 of the bridge needs care.

## Decision

**Chosen:** _TBD_

## Consequences

_Fill in once a decision is made._

## Open Questions

- Should Mosiac optionally publish `did:plc` entries? (See
  bluesky-social/atproto `@atproto/identity`.)
- Does brand-portal Convex auth need a "this is also a Mosiac user"
  flag for downstream tooling?
- How does an unauthenticated visitor to the brand portal become a
  customer without knowing Mosiac exists yet?

## References

- `maple-spike/DESIGN.md` §Identity (planned)
- `maplespike-relay/src/auth/atproto.ts` (existing Bluesky atproto
  bridging — useful precedent)
- https://github.com/bluesky-social/pds
- https://github.com/bluesky-social/atproto (`@atproto/identity`)
