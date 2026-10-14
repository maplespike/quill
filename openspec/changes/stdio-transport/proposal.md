# Proposal: Local stdio transport for quill-mcp

## Why

Issue #1042 and PR #1046 already specify the stdio transport. The code was written. It was not on current `main`, and the install docs still tell a host to run `npx @maplespike/quill-mcp`. That package is not on the npm registry. A host that follows the docs cannot start the server. The bin that does exist (`dist/cli.js`) must be the file the docs and the container CMD name.

## What Changes

- Bring the #1046 stdio implementation onto current `main` without a rewrite. `dist/cli.js` speaks newline-delimited JSON-RPC. stdout carries protocol frames only. The process exits 0 when stdin closes.
- Keep `dist/index.js`, `pnpm start:sse`, and `Dockerfile.mcp` as the hosted SSE server.
- Stop install instructions from advertising `npx`. Point them at `node packages/quill-mcp/dist/cli.js` after a local build.
- Record that PR #1059 (`issue-1058-mcp-sse-readiness`) auto-merges. The only shared file is `packages/quill-mcp/src/server.ts`, and the hunks do not overlap.

## Capabilities

### New Capabilities

- `mcp-stdio-transport`: Local MCP over stdin/stdout, with a protocol-only stdout and a clean exit when the host closes stdin.

### Modified Capabilities

- None. No existing spec in `openspec/specs/` defines the MCP transport.

## Impact

- Affected packages: `@maplespike/quill-mcp`, `@maplespike/pipeline-core` (one import-time log moves to stderr).
- MCP contract: the local bin changes from "start the SSE listener" to "stdio JSON-RPC". The hosted SSE routes do not change in this change.
- Dependencies: no new packages. The dispatcher stays the in-repo `McpServer`.
- npm: do not publish. Docs must match the registry, which does not contain `@maplespike/quill-mcp`.
- In-flight PR #1059: textual merge is clean. See design for the shared `server.ts` note.
