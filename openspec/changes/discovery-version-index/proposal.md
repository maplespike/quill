## Why

Generated discovery dates drift from `docs/metrics.json`. The MCP dispatcher reports `0.1.0` while `packages/quill-mcp` is `0.4.0`. The root package reports `0.2.0`. `tool-index.json` lists 169 tools while `getAllTools()` returns 184.

## What Changes

- Refresh portal discovery artifacts to the canonical metrics date.
- Assert those dates and the byte-identical server-card aliases in the portal smoke test.
- Read the dispatcher version from `packages/quill-mcp/package.json`.
- Set the root package version to `0.4.0`.
- Regenerate `tool-index.json` from the live registry and lock it with a test.
- Record the 2026-10-14 readiness notes, the five-PR split, and the SSE security findings.

## Capabilities

### New Capabilities

- `discovery-version-index`: Discovery dates, dispatcher version, and the tool index match the live registry.

## Impact

Portal generated JSON, two package versions, the MCP dispatcher version source, the tool index, and one readiness note. No transport, lockfile, or workflow change. API response headers stay `0.1.0`. Related to #1058. Builds from `main` by itself. `server.ts` does not overlap the transport PR, which edits `index.ts` only.
