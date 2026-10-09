# Design: Claim raw-body retention (#989)

## Context

`buildClaimBundle()` computes the record-integrity SHA-256 over `canonicalJson(item.value)` but discards the serialized bytes: the bundle persists `value` (as JSON inside `citation_json`) and the digest, yet nothing guarantees a reader can reproduce the digest from the bundle alone. Re-verification today therefore depends on re-canonicalizing `value` — which works until the canonicalization algorithm, key order, or JSON serialization settings drift — or on re-fetching a mutable upstream. `recordToClaim()` in the ingest hook content-addresses every parsed record but retained nothing.

## Goals

- Every claim bundle carries the exact byte string its recorded SHA-256 covers.
- Digest and retained bytes cannot disagree (single hashing path).
- Retention works for both hook-registered claims and direct `buildClaimBundle` callers.
- Legacy rows without retained bytes stay readable; absence is never fabricated.

## Non-Goals

- Do not retain upstream HTTP response bodies end-to-end; `acquisition.artifacts` already digests those with their own SHA-256 and `body_capture` state. A content-addressed response store with size caps and lifecycle policy is future work.
- Do not add a storage substrate, migration, or retention window.
- Do not change public API/MCP tool output shapes.

## Decisions

### D1: Retain the hashed serialization, not the raw HTTP response

The claim digest's scope is "canonical JSON of the record" (record_integrity.scope = `canonical-json-record`), not the wire bytes. Retaining exactly what was hashed is the minimal change that makes the existing digest independently checkable months later. Upstream response retention would require fetcher-specific record↔artifact linkage (still unresolved, see PROVENANCE.md limitations) and a lifecycle policy — both out of scope and previously declared out of scope in `claim-provenance-evidence`.

### D2: `rawBody` is hashed when supplied

`buildClaimBundle` hashes `item.rawBody ?? canonicalJson(item.value)` and persists that same string as the bundle's `rawBody`. A caller who retained specific bytes gets a digest over those bytes — retention and digest cannot disagree. A caller who supplies nothing gets the freshly canonicalized serialization retained automatically. This is a deliberate property, not a convenience: it makes `sha256(rawBody) === bundle.sha256` an invariant.

### D3: Field placement on ClaimItem and ClaimBundle

`rawBody?: string` lives on `ClaimItem` (input) and is inherited by `ClaimBundle` (output), flowing through the existing bundle spread in `buildClaimBundle`. The citation store persists the whole bundle in `citation_json`, so retention needs no schema change; `INSERT OR IGNORE` dedupe is unchanged (hash is the key).

### D4: No secret-redaction pass

`rawBody` is the canonical form of `value`, which is already persisted verbatim inside `citation_json`. Redaction applies to URLs and evidence inputs before this point (see `redactArtifactUrl` usage); the record value itself is not sanitized today and this change does not alter that boundary.

## Data Flow

`recordToClaim` → `rawBody = canonicalJson(record)` → `buildClaimBundle` (hashes the same string) → `ClaimBundle.rawBody` → `CitationStore.put` (citation_json) → `CitationStore.get` → `verifyClaimHash` / reader. Every step carries the same immutable string; no re-serialization happens after hashing.

## Security / Rollout / Rollback

- Security: no new inputs from untrusted sources; the retained body is a deterministic function of already-persisted `value`. Bundle size grows by roughly `len(canonicalJson(value))` — bounded by the existing per-record size, no new amplification (the bytes were already stored inside `citation_json.value`).
- Rollout: additive optional field; readers tolerate its absence (legacy rows). Writers start retaining immediately; no migration.
- Rollback: revert the commit; stored rows with `rawBody` remain readable because readers do not require the field.
