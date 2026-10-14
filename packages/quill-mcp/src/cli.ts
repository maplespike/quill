#!/usr/bin/env node
// Quill MCP zero-config entry point — stdio transport.
//
// Run, after a local build: `node dist/cli.js` or `pnpm start`.
// That is the stdio entry for Claude Desktop, Cursor, and any MCP host.
// `@maplespike/quill-mcp` is not published on npm. `npx` cannot install it.
// `pnpm start:sse` starts the hosted HTTP/SSE server instead (src/index.ts).
//
// stdout belongs to the JSON-RPC protocol here, so this module claims stdout
// before loading anything that could print to it:
//   - console.* is redirected to stderr (stdio-guard.ts)
//   - the pino logger switches its destination to stderr (logger.ts, keyed on
//     QUILL_MCP_TRANSPORT=stdio)
//
// Order matters. Some offending writes happen during `import` — pipeline-core
// logs "[Municipal] hydrated N pre-discovered IDs from build-time registry"
// while building its registry — so the guard has to be installed before the
// dynamic import below, not inside it. That is why the server is loaded with
// `await import()` rather than a static import that would be hoisted above
// these statements.

import { claimStdoutForProtocol } from './stdio-guard.js';

claimStdoutForProtocol();
process.env.QUILL_MCP_TRANSPORT ??= 'stdio';

const { startStdioServer } = await import('./stdio-server.js');

await startStdioServer();
