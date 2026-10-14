## ADDED Requirements

### Requirement: Injected copies before portal generation
The workspace build MUST refresh injected `@maplespike` copies after compilation and before the portal build.

#### Scenario: Portal generators import workspace packages
- **Given** `tsc -b` has written `packages/database/dist`
- **When** the portal build imports `@maplespike/pipeline-core` through the pnpm store
- **Then** that import resolves `@maplespike/database/dist`

### Requirement: Mandatory generator failure
`gen:all` MUST stop when a mandatory generator exits non-zero.

#### Scenario: Icon generator fails
- **Given** `gen-icons.mjs` exits 23
- **When** `gen:all` runs
- **Then** the command exits 23

#### Scenario: Optional pipeline timeout
- **Given** the pipeline-data generator times out
- **When** `gen:all` runs
- **Then** later mandatory generators still run
