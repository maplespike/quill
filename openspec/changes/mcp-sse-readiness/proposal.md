## Why

The advertised SSE transport emits a JSON object instead of the endpoint URI that MCP clients expect. Message posts are not bound to the authenticated stream owner. A healthy process does not prove a usable or secure client connection.

## What Changes

- Emit the endpoint event as a relative URI string.
- Generate random session IDs and bind each stream to a hashed Bearer credential and quota identity.
- Reject message posts from missing or different credentials.
- Add real HTTP protocol and shutdown regression tests.

## Capabilities

### New Capabilities
- `mcp-sse-session`: Compatible endpoint discovery and owner-bound command delivery.

## Impact

Only the hosted MCP transport and its tests change. No new dependency, public route, deployment, credential rotation, or pricing change. Existing stdio PR #1046 remains separate. Tracks #1058.
