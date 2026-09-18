# agent-discovery Specification

## Purpose
TBD - created by archiving change agent-discovery-surface. Update Purpose after archive.

## Requirements

### Requirement: MCP server card at well-known paths

The portal SHALL publish a machine-readable MCP server card, generated from `docs/metrics.json`, at both `/.well-known/mcp/server-card.json` and `/.well-known/mcp/server-cards.json` with byte-identical content.

#### Scenario: Client fetches the server card

- **WHEN** a client requests `https://quill.maplespike.ca/.well-known/mcp/server-cards.json`
- **THEN** the response SHALL be HTTP 200 with `Content-Type: application/json` and `Access-Control-Allow-Origin: *`, and the document SHALL declare `name` `ca.maplespike/quill`, a semantic `version`, and a `remotes` entry whose `url` is `https://mcp.maplespike.ca/sse`

#### Scenario: Counts never drift from the canonical metrics

- **WHEN** `docs/metrics.json` changes
- **THEN** regenerating the discovery artifacts SHALL update the module and tool counts in the server card and agent card, and the artifact validator SHALL fail whenever any published count disagrees with `docs/metrics.json`

### Requirement: Truthful agent card

`packages/portal/public/agent-card.json` SHALL report the canonical module and MCP-tool counts, the public portal URL, and a verification claim scoped to shipped surfaces (`/v1/claims/verify/{hash}` and the `get_citation` tool).

#### Scenario: Stale count guard

- **WHEN** the agent card is regenerated after a count change
- **THEN** no legacy count strings (for example "65+ modules" or "30+ MCP tools") SHALL remain in the artifact, and the artifact validator SHALL pass

#### Scenario: Verification claim stays scoped

- **WHEN** the agent card is regenerated
- **THEN** its `capabilities.verification` text SHALL reference `/v1/claims/verify/` and `get_citation`, and SHALL NOT claim blanket hash coverage that the tool set does not provide

### Requirement: Agent-readable discovery pointers

`llms.txt` SHALL reference the MCP endpoint, the MCP server card, the agent card, and the public claims and data-quality endpoints; `llms-full.txt` SHALL carry the same discovery pointers.

#### Scenario: Pointer presence

- **WHEN** the llms files are regenerated
- **THEN** `llms.txt` SHALL contain `mcp.maplespike.ca/sse`, `.well-known/mcp/server-cards.json`, `agent-card.json`, `/v1/claims/latest`, `/v1/claims/verify/:hash`, and `/v1/data/quality`

### Requirement: Build and serve guarantees for discovery paths

The portal build SHALL place the `.well-known` directory into the served output through an explicit post-build sync step, and the portal server SHALL serve `/.well-known/*` with CORS headers and a 3600-second cache lifetime.

#### Scenario: Dot-directory lands in the built site

- **WHEN** the portal build completes
- **THEN** `dist/.well-known/mcp/server-cards.json` SHALL exist, SHALL parse as JSON, and the production smoke test SHALL include passing discovery assertions

#### Scenario: Unknown discovery path

- **WHEN** a client requests an unknown path under `/.well-known/`
- **THEN** the server SHALL return HTTP 404 (negative control)
