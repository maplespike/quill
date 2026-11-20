## Why

Quill MCP sends verification requests to a route Astral Key does not expose, rejecting valid Astral access tokens.

## What Changes

- Call the versioned verification endpoint and reject failed or stalled responses.
- Cover the request contract and error handling with an HTTP regression test.

## Capabilities

### New Capabilities

- `mcp-astral-verification`: delegated Astral access-token verification.

## Impact

Quill MCP and its configuration documentation change; the Astral Key HTTP contract remains unchanged. No new dependencies. Related to #1354; safe rollout requires Astral Key issue reverb256/astral-key#69 first.
