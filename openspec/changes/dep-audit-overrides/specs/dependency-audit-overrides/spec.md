## ADDED Requirements

### Requirement: Patched override floors
The workspace override set MUST raise undici, smol-toml, nodemailer, `@grpc/grpc-js`, source-map-js, fast-copy, and sharp to the patched floors in this change.

#### Scenario: Frozen install
- **Given** this lockfile
- **When** `pnpm install --frozen-lockfile` runs
- **Then** install succeeds
- **And** those packages resolve at or above the new floors

### Requirement: Unfixed advisory stays visible
The change MUST NOT override or suppress `http-cache-semantics` while GHSA-ch52-4w7c-c8xp has no fixed version.

#### Scenario: Audit output
- **Given** a production audit
- **When** the audit reports GHSA-ch52-4w7c-c8xp
- **Then** the report is not silenced by this change
