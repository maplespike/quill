## ADDED Requirements

### Requirement: The package bin is the stdio server

The `quill-mcp` bin and `pnpm start` MUST run the compiled stdio entry point `packages/quill-mcp/dist/cli.js`. That process MUST read newline-delimited JSON-RPC from stdin and write newline-delimited JSON-RPC to stdout. `pnpm start:sse` and `Dockerfile.mcp` MUST keep running `dist/index.js`, the hosted HTTP/SSE server.

#### Scenario: Built bin answers initialize

- **WHEN** a host writes an `initialize` request to the stdin of `node packages/quill-mcp/dist/cli.js` and then closes stdin
- **THEN** stdout contains a JSON-RPC result for that request
- **AND** the process exits 0

#### Scenario: Container stdio image uses the same file

- **WHEN** an operator reads `Dockerfile.glama`
- **THEN** the image `CMD` is `node packages/quill-mcp/dist/cli.js`
- **AND** the hosted image `CMD` in `Dockerfile.mcp` remains `node packages/quill-mcp/dist/index.js`

### Requirement: Stdout carries protocol frames only

In stdio mode, every complete line on stdout MUST be a JSON-RPC 2.0 object. Logs, import-time notices, and pretty-printed logger output MUST go to stderr. This MUST hold for `NODE_ENV=production` and for a non-production `NODE_ENV`.

#### Scenario: Production handshake stays pure

- **WHEN** the built entry point runs with `NODE_ENV=production` and the host completes `initialize` and `tools/list`
- **THEN** every non-empty stdout line parses as JSON with `jsonrpc` equal to `2.0`
- **AND** `tools/list` returns the live tool registry

#### Scenario: Development logs do not use stdout

- **WHEN** the built entry point runs with `NODE_ENV=development` and the host completes the same handshake
- **THEN** every non-empty stdout line is a JSON-RPC 2.0 object
- **AND** the ready log line is on stderr

### Requirement: The process exits when stdin closes

The stdio server MUST exit 0 after stdin closes and after it has flushed every response for data already read. A host restart MUST NOT leave the server waiting on a closed pipe.

#### Scenario: Clean exit

- **WHEN** the host closes stdin after a successful handshake
- **THEN** the process exit code is 0

### Requirement: Install docs match the registry

User-facing install instructions MUST NOT tell the reader to run `npx @maplespike/quill-mcp` while that package is absent from the npm registry. They MUST give the checkout command `node packages/quill-mcp/dist/cli.js` (or `pnpm start` inside the package after a build).

#### Scenario: npm package is absent

- **WHEN** `npm view @maplespike/quill-mcp` returns 404
- **THEN** the package README, `packages/docs/mcp/setup.md`, and the product quick start name `dist/cli.js` as the local command
- **AND** they state that `npx` cannot install the package
