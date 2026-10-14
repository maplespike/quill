## Why

The hosted SSE transport announces a JSON endpoint object, accepts message posts that do not match the stream owner, and keeps a revoked credential usable on an open stream.

## What Changes

- Emit a plain relative endpoint URI.
- Bind each stream to a random UUID, the owner's credential hash, and the quota identity captured at open.
- Authenticate the owner again on every POST. Drop the stream when that check fails.
- Cap concurrent sessions, expire idle streams, and drop a client whose write buffer exceeds the cap.
- Reject a body over 1 MiB and do not run that command.
- Add HTTP tests for isolation, revocation, the connection cap, idle expiry, oversize bodies, and disconnect.

## Capabilities

### New Capabilities

- `mcp-sse-session`: Compatible endpoint discovery, owner-bound delivery, and session limits.

## Impact

Only the hosted MCP transport and its HTTP tests change. No new dependency, chart change, credential rotation, or `TRUST_PROXY` change. The MCP deployment does not set `TRUST_PROXY`. Related to #1058. This slice builds from `main` by itself. Build sync, dependency overrides, Rust CI, and discovery artifacts are separate PRs.
