## Context

Clients authenticate `GET /sse` and then post JSON-RPC commands to the URI in the first endpoint event. Main uses sequential session IDs, emits a JSON endpoint object, and derives identity from unverified POST headers. An open stream also kept the credential that opened it, with no later check.

## Decisions

1. Emit `event: endpoint` with an unquoted relative URI. Keep message events JSON encoded.
2. Use `randomUUID` for session IDs. Store a SHA-256 digest of the Bearer token. Store no plaintext token.
3. Reject a POST whose digest does not match the stream owner. Do not drop the stream for a different credential.
4. Call `authenticate()` again for the owner on every POST. Drop the stream when the check fails. Read `QUILL_API_KEY` on each call.
5. Capture quota identity at stream open and pass it into `handleMessage`. Do not take identity from POST headers.
6. Honor `X-Forwarded-For` only when `TRUST_PROXY=true`. Do not set that variable on the MCP deployment. The chart sets it on the API container only.
7. Bound sessions with `QUILL_SSE_MAX_CLIENTS` (default 128), command idle with `QUILL_SSE_IDLE_MS` (default 15 minutes), and the write buffer with `QUILL_SSE_MAX_BUFFER` (default 1 MiB). Heartbeats use `QUILL_SSE_HEARTBEAT_MS` (default 30 seconds) and do not reset idle.
8. Reject `Content-Length` or accumulated bytes over 1 MiB with 413. A rejected body must not reach the command handler. An oversize body does not drop the session.
9. `dropClient` clears timers and ends the response. Client close, revocation, buffer overflow, and SIGTERM/SIGINT all use it. SIGTERM flushes quota first.

## Security review

Confirmed and fixed in this change:

- Revoked or expired credentials stayed usable. POST compared only the hash from GET. Tenant-key and JWT checks were not repeated.
- No connection cap, idle expiry, or slow-client bound. Disconnect cleanup did not cover the revoke path.
- A chunked body over 1 MiB could still run the `end` handler after `destroy`.

Not a defect in this design:

- Shared `McpServer` fields `initialized` and `clientCapabilities` are written and never read. Tool results are written to that session's response. One session's `tools/list` does not appear on another session.
- `Access-Control-Allow-Origin: *` is set on the root redirect and the SSE response. There is no OPTIONS handler and no `Access-Control-Allow-Headers`. A browser call with `Authorization` fails preflight. Production `GET /sse` without a bearer returns 401.
- MCP rate limits use the socket address because `TRUST_PROXY` is unset. Clients behind one ingress share one 60/minute bucket. That is an availability limit. Setting `TRUST_PROXY=true` without a proxy that strips client `X-Forwarded-For` would allow spoofing.
- `recordCall` updates an in-process map with no await. The chart runs one MCP replica. SIGTERM calls `flushSync`. A crash before the debounce can under-count. A second replica would keep its own counts. This change does not add a replica.

## Rollout

Production auth stays on. `QUILL_API_KEY=dev-key` bypasses auth only when `NODE_ENV` is not `production`. The MCP chart sets `NODE_ENV=production`. No credential, billing, or cluster change. Rollback restores the previous transport image.

## Verification

HTTP tests cover framing, owner rejection, a catalog call, shutdown, session isolation, tenant-key revocation, the connection cap, idle close, a body over 1 MiB, and disconnect. Run the quill-mcp HTTP route file with `tsx --test`.
