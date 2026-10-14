## Context

Clients authenticate GET /sse and then post JSON-RPC commands to the endpoint named by its first event. The current implementation has sequential session IDs, emits a JSON endpoint object, and derives identity from unverified POST headers.

## Decisions

1. Emit `event: endpoint` with an unquoted relative URI in its data field. Keep message events JSON encoded.
2. Use node:crypto randomUUID for session IDs. Capture a SHA-256 digest of the normalized Bearer token when authenticating the stream. Store no plaintext token.
3. Reject a POST unless its normalized credential digest matches the stream owner. The prior authenticated stream proves this credential was accepted. Dev-mode anonymous streams still require the same empty credential.
4. Capture quota identity at stream creation and reuse it for every command. Unverified POST headers cannot choose another quota identity.
5. Use the socket IP for rate limits unless TRUST_PROXY is enabled, matching quota proxy trust.
6. End active streams on SIGTERM as well as SIGINT, allowing the HTTP listener to close.

## Security and Rollout

Production auth remains required. Session IDs are not authentication. Clients must send the same Authorization header on GET and POST. No credential, billing, storage, or cluster changes are made. Merge and deployment require separate approval. Rollback restores the previous transport image, but also restores its session isolation defect.

## Verification

Real HTTP tests parse endpoint events as URI text, initialize, enumerate all tools, call a read-only catalog tool, reject missing and wrong-owner credentials, and confirm graceful termination with an open stream. Run package typecheck, unit and integration suites. No speedup is claimed.
