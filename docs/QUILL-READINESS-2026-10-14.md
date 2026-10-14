# Quill readiness — 2026-10-14

## Result

Local repairs are split into five pull requests. Production is not updated. This is not a claim that all Quill issues are closed.

Issue: https://github.com/maplespike/quill/issues/1058
Umbrella: https://github.com/maplespike/quill/pull/1059 (draft reference; do not merge)
Base: `fc807cc0`

| Order | PR | Branch | Slice |
| --- | --- | --- | --- |
| 1 | https://github.com/maplespike/quill/pull/1063 | `cursor/mcp-sse-session-597b` | MCP transport and session isolation |
| 2 | https://github.com/maplespike/quill/pull/1060 | `cursor/workspace-build-sync-597b` | Workspace build sync and portal generation |
| 3 | https://github.com/maplespike/quill/pull/1062 | `cursor/dep-audit-overrides-597b` | Security dependency overrides |
| 4 | https://github.com/maplespike/quill/pull/1061 | `cursor/rust-ci-env-597b` | Rust CI toolchain lookup |
| 5 | https://github.com/maplespike/quill/pull/1064 | `cursor/discovery-version-index-597b` | Discovery artifacts, version 0.4.0, 184-tool index |

Each slice builds from `main` by itself. Review them in that order. Slices 2 and 3 both edit `pnpm-workspace.yaml` in different regions.

## Repaired locally

- Hosted SSE endpoint events now contain a plain relative URI, not a JSON object.
- Session IDs use random UUIDs. Message posts must carry the stream owner's credential. Quota identity comes from the authenticated stream.
- The owner credential is checked again on every POST. A failed check drops the stream.
- Sessions have a connection cap, command idle expiry, and a slow-client write-buffer cap. Defaults: 128 sessions, 15 minutes, 1 MiB, 30-second heartbeats. Heartbeats do not reset idle.
- A body over 1 MiB returns 413 and does not run the command.
- IP rate limits honor forwarded headers only with `TRUST_PROXY=true`. The MCP deployment does not set that variable.
- SIGTERM closes open SSE streams and flushes quota before shutting down the listener.
- pnpm lists `build` in `syncInjectedDepsAfterScripts`. `scripts/build-packages.sh` repairs injected copies after `tsc -b` and before the portal build.
- Portal generation stops on mandatory generator failure. Only the existing optional pipeline-data timeout remains tolerated.
- Discovery artifacts now match the canonical metrics date. Built-output tests assert both aliases and dates.
- The dispatcher reads `packages/quill-mcp/package.json` (0.4.0). The root package version is 0.4.0. API response headers stay 0.1.0.
- `tool-index.json` lists the 184 live tools.
- Effective pnpm overrides update undici, nodemailer, grpc-js, smol-toml, source-map-js, fast-copy, and sharp.
- Rust CI resolves the provisioned toolchain and fails when cargo is missing. The three self-hosted jobs skip fork pull requests.

## SSE security review

Confirmed and fixed in the transport slice:

- A revoked or expired credential stayed usable on an open stream. POST compared only the hash captured at GET.
- There was no connection cap, idle expiry, or slow-client bound.
- A chunked body over 1 MiB could still reach the command handler after the request was destroyed.
- Disconnect cleanup did not cover the revoke path. Close, `dropClient`, and SIGTERM/SIGINT now clear timers.

Not a defect:

- Shared `McpServer` fields `initialized` and `clientCapabilities` are unread. A `tools/list` result is written only to the session that posted it.
- `Access-Control-Allow-Origin: *` does not allow a browser to send `Authorization`. There is no preflight allow-list. Production `/sse` without a bearer returns 401.
- MCP does not set `TRUST_PROXY`. `X-Forwarded-For` is ignored. Clients that share the ingress socket share one 60/minute bucket. That is an availability limit. Do not set `TRUST_PROXY=true` on MCP unless the proxy strips a client-supplied forwarded header.
- Quota updates are in-process and the chart runs one MCP replica. SIGTERM calls `flushSync`. A crash before the debounce can under-count.

## Verification

Local checks before the split:

| Check | Result |
| --- | --- |
| MCP HTTP routes, including session limits | 12 passed, 0 failed (Node 22.23.3) |
| MCP unit and protocol tests for version and tool index | 28 passed |
| Rust formatting, Clippy, and library tests on a runner with cargo | Passed on nexus |
| Rust fmt on `sentry-quill-runner` | Failed closed: cargo is not installed for that runner user |
| Umbrella QA portal build | Failed: injected database dist was repaired after `portal build` |

The build-script order in slice 2 is the repair for that QA failure. Do not install a Rust toolchain from CI.

## Marketplace corrections

The mcprush public page now says `Publisher Verified`. No marketplace edit was submitted by this agent.

- Auth must say **Bearer API key required**, not `None — open`. Live unauthenticated `/sse` returns 401. Keep production auth enabled.
- Publish the 184-tool catalog after the hosted transport fix is deployed and authenticated introspection is verified.
- Package metadata and the dispatcher in slice 5 report 0.4.0. Production still reports the deployed image until a separate rollout. API headers stay 0.1.0.
- Replace the Lifestyle & Local classification with the closest government/public-data/research category available in the publisher dashboard.
- State that mcprush charges nothing, while hosted Quill has its own free quota and paid plans. Do not promise unlimited hosted usage.
- Scope SHA-256 provenance claims to supported claim/cross-reference surfaces. Do not imply every legacy row has evidence.
- Correct command:

```bash
claude mcp add --scope user --transport sse \
  --header "Authorization: Bearer YOUR_QUILL_API_KEY" \
  quill https://mcp.maplespike.ca/sse
```

Keys are issued through https://quill.maplespike.ca/signup. Never place a real key in source or this report.

Canonical discovery: https://quill.maplespike.ca/.well-known/mcp/server-cards.json

## Unresolved release blockers

1. **Unpatched dependency:** `http-cache-semantics <=4.2.0`, GHSA-ch52-4w7c-c8xp / CVE-2026-93748. `4.3.0` does not fix it. No override and no audit suppression. See #1047.
2. **Live rollout:** these slices are not deployed. No production signup, email, charge, or account mutation was made.
3. **Stdio release:** #1046 stays a separate open PR.
4. **Privacy/CASL/renewal:** #1038 is not part of this split.
5. **Credential history:** #854 and #1043 stay separate. No credentials were rotated.
6. **Licensing:** #1044 is not part of this split.
7. **Provenance:** #991 and #986 stay separate.
8. **CI runners:** fork code must not run on self-hosted runners. Slice 4 copies the #1045 guard onto the Rust jobs only. #1045 itself stays open. `sentry-quill-runner` still needs cargo provisioned by an operator.
9. **Broader coverage:** ingestion modules, AI providers, payment methods, browser journeys, retention, and disaster recovery were not exhaustively verified.

## Boundaries

No merge, deployment, paid purchase, production account creation, credential rotation, or production-data mutation occurred. Licensing and privacy text were not edited.
