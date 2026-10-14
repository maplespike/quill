## ADDED Requirements

### Requirement: Dispatcher version matches the package
The MCP `initialize` result MUST report the `version` field from `packages/quill-mcp/package.json`.

#### Scenario: Initialize
- **Given** the quill-mcp package version
- **When** a client sends `initialize`
- **Then** `serverInfo.version` equals that version

### Requirement: Tool index matches the live registry
`packages/quill-mcp/src/tools/tool-index.json` MUST list every live tool name and the first 200 characters of its description.

#### Scenario: Registry comparison
- **Given** `getAllTools()`
- **When** the tool-index test reads the file
- **Then** the parsed entries equal the live name and sliced description list

### Requirement: Discovery dates match metrics
Generated portal discovery artifacts MUST use the date recorded in `docs/metrics.json`.

#### Scenario: Built portal smoke
- **Given** a built portal `dist/`
- **When** the dist smoke test runs
- **Then** discovery dates match `docs/metrics.json`
- **And** the server-card aliases are byte-identical
