---
"@maplespike/quill-mcp": patch
---

The `quill-mcp` bin speaks MCP over stdio. `pnpm start` runs `dist/cli.js`. stdout carries JSON-RPC frames only. The process exits 0 when stdin closes. `@maplespike/quill-mcp` is not on npm. Build this repo and run `node packages/quill-mcp/dist/cli.js`.
