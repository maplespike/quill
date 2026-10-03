## ADDED Requirements

### Requirement: Record hash scope is explicit

A claim bundle SHALL identify the record-integrity hash as SHA-256 of Quill's canonical JSON representation of the record value. It SHALL distinguish this digest from any source-response digest and SHALL NOT describe the hash as proof of source identity, completeness, authenticity, or reuse rights.

#### Scenario: Record hash and response hash have separate scopes

- **WHEN** a stored claim has both a record hash and captured source-response evidence
- **THEN** the evidence SHALL expose separate digests and state that the record digest covers canonical record JSON while the artifact digest covers the HTTP-client response body

#### Scenario: Hash verification finds a record

- **WHEN** a claim hash is found in Quill's store or prebuilt index
- **THEN** the API MAY report the hash/index match, but user-facing contract text SHALL explain that this does not authenticate the source or establish reuse rights

### Requirement: Artifact evidence association is conservative

Explicit record-supplied source-artifact evidence SHALL be retained when structurally valid, even when its association with the record cannot be established. A request-local HTTP capture SHALL be attached to a claim only when both capture URL and record source URL are valid absolute HTTP(S) URLs that match after documented query, fragment, and credential redaction. URL matching SHALL be described as URL-only association and SHALL NOT be represented as content lineage.

#### Scenario: Explicit artifact URL does not match record source URL

- **WHEN** a record includes valid explicit artifact evidence whose URL differs from the record source URL
- **THEN** the evidence SHALL preserve the artifact, set acquisition status to `captured`, and set association to `not-established`

#### Scenario: Captured request URL matches record source URL

- **WHEN** a module-run HTTP request and record source URL are valid HTTP(S) URLs that match after the documented redaction rules
- **THEN** the evidence MAY attach that artifact with association `url-matched-not-content-verified`

#### Scenario: Missing or invalid URLs do not match

- **WHEN** either URL is empty, relative, malformed, or uses a non-HTTP(S) scheme
- **THEN** the artifact SHALL NOT be associated by URL equality

#### Scenario: Multiple request artifacts exist

- **WHEN** multiple captured requests have the same normalized URL
- **THEN** all matching artifacts SHALL remain available in capture order; nonmatching captured artifacts SHALL NOT be attached to that claim

### Requirement: Capture status and timestamps describe observed events

The artifact body-capture state SHALL report whether the HTTP client fully read the body, including an empty body. Claim-registration time SHALL NOT be represented as source retrieval time. If source acquisition time is unavailable, retrieval-time fields SHALL be null or omitted and evidence SHALL remain unknown.

#### Scenario: Empty HTTP response body is fully read

- **WHEN** the HTTP client successfully reads a zero-length response body
- **THEN** the artifact SHALL record the SHA-256 of the empty body, zero byte length, and body capture state `complete-http-client-body`

#### Scenario: Claim registration has no source retrieval timestamp

- **WHEN** a claim is built without an observed artifact acquisition timestamp
- **THEN** its source retrieval timestamp SHALL be null or omitted, while any separate claim creation timestamp MAY remain available under a distinct name

### Requirement: Publisher terms evidence does not infer rights

Publisher terms evidence SHALL distinguish publisher metadata observed on a record, Quill source configuration, and not observed. Missing terms evidence SHALL NOT be interpreted as permission, prohibition, or a conclusion that terms do not exist. No runtime license gate SHALL be added by this capability.

#### Scenario: Configured terms are not promoted to publisher evidence

- **WHEN** a claim receives a license label only from Quill source configuration
- **THEN** provenance evidence SHALL report `source-configuration-only` and SHALL NOT report `publisher-metadata-observed`

#### Scenario: Terms are unavailable

- **WHEN** no publisher terms metadata was observed
- **THEN** the bundle SHALL report `not-observed` without inferring a reuse decision

### Requirement: Historical claims remain readable

Readers SHALL tolerate previously persisted claim bundles that lack the v1 provenance-evidence object or source retrieval timestamp. Missing v1 evidence SHALL be exposed as unavailable/unknown without fabricating acquisition details or blocking claim verification.

#### Scenario: Legacy stored bundle is retrieved

- **WHEN** a persisted citation JSON row predates v1 evidence
- **THEN** lookup SHALL continue to return the stored claim and hash, expose null/unavailable provenance evidence, and not invent a source retrieval timestamp
