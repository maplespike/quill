## ADDED Requirements

### Requirement: Claim bundles retain their hashed bytes

A claim bundle SHALL retain, under `rawBody`, the exact byte string its recorded SHA-256 was computed over. Retained bytes SHALL be sufficient to re-verify the recorded digest locally, without re-fetching any upstream source and without depending on a specific record shape.

#### Scenario: Ingestion registers a claim with retained bytes

- **WHEN** `registerModuleClaims` content-addresses a parsed record
- **THEN** the stored bundle SHALL carry a `rawBody` equal to the canonical JSON of that record, and hashing `rawBody` with SHA-256 SHALL reproduce the bundle's `sha256`

#### Scenario: A caller supplies a retained body

- **WHEN** a caller builds a claim bundle with an explicit `rawBody`
- **THEN** the recorded SHA-256 SHALL be computed over that `rawBody`, so the retained bytes and the digest cannot disagree

#### Scenario: Retained bytes survive the store round-trip

- **WHEN** a bundle with `rawBody` is persisted and later retrieved
- **THEN** the retrieved bundle SHALL expose the same `rawBody` and the same `sha256`, so verification remains possible after persistence

### Requirement: Absence of retained bytes is not fabricated

A bundle built without a retained body SHALL omit `rawBody` or carry the canonical serialization it was hashed over. Readers SHALL tolerate legacy persisted bundles that lack `rawBody` and SHALL NOT fabricate retained bytes for them.

#### Scenario: Legacy stored bundle is retrieved

- **WHEN** a persisted citation JSON row predates `rawBody` retention
- **THEN** lookup SHALL continue to return the stored claim and hash, and `rawBody` SHALL remain absent or undefined rather than synthesized

#### Scenario: Hash verification without retained bytes

- **WHEN** a bundle lacks `rawBody`
- **THEN** `verifyClaimHash(value, sha256)` SHALL keep operating on the caller-supplied record value as before
