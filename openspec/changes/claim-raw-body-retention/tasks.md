# Tasks

## 1. Types and bundle construction

- [x] 1.1 Add optional `rawBody?: string` to `ClaimItem` and `ClaimBundle` (`packages/pipeline-core/src/claims/index.ts`).
- [x] 1.2 `buildClaimBundle` hashes the supplied `rawBody` when present; otherwise hashes the canonical JSON of `value`.
- [x] 1.3 The constructed bundle carries the retained bytes through the existing bundle spread.

## 2. Ingestion hook retention

- [x] 2.1 `recordToClaim` sets `rawBody` to `canonicalJson(record)` for every registered record.

## 3. Tests

- [x] 3.1 Hashing a bundle's retained bytes reproduces its `sha256` (retention → digest).
- [x] 3.2 A caller-supplied `rawBody` is hashed as-is and persists through the store round-trip.
- [x] 3.3 Ingestion-registered claims carry the canonical record bytes; hash agreement holds.
- [x] 3.4 Legacy/persisted bundles without `rawBody` remain readable and un-fabricated.
- [x] 3.5 Regression: earlier `buildClaimBundle` dropped caller-supplied non-`ClaimBundle` fields silently — retained bytes now persist on the bundle.
