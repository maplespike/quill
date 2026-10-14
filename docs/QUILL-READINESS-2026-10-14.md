# Quill readiness — 2026-10-14

## Result

Local repairs are verified. Production is not updated. This is not a claim that all Quill issues are closed.

Worktree: `/home/j_kro/Work/quill-1058`
Branch: `issue-1058-mcp-sse-readiness`
Issue: https://github.com/maplespike/quill/issues/1058
Base: `fc807cc0`

## Repaired locally

- Hosted SSE endpoint events now contain a plain relative URI, not a JSON object.
- Session IDs use random UUIDs. Message posts must carry the stream owner's credential. Quota identity comes from the authenticated stream.
- IP rate limits honor forwarded headers only with `TRUST_PROXY=true`.
- SIGTERM closes open SSE streams before shutting down the listener.
- HTTP tests launch Node directly and can test the compiled entry point with `QUILL_TEST_BUILT=1`.
- pnpm refreshes injected workspace dependencies after `build`. This fixes missing compiled database files in the MCP runtime and portal generators.
- Portal generation stops on mandatory generator failure. Only the existing optional pipeline-data timeout remains tolerated.
- Discovery artifacts now match the canonical metrics date. Built-output tests assert both aliases and dates.
- Effective pnpm overrides update undici, nodemailer, grpc-js, smol-toml, source-map-js, fast-copy, and sharp. The production audit fell from 23 advisories (9 high, 10 moderate, 4 low) to one high advisory.
- Rust CI explicitly resolves the provisioned toolchain in non-login shells. The preflight also works on nexus with an empty usable PATH. No host configuration changed.

## Verification

After dependency updates:

| Check | Result |
| --- | --- |
| Workspace forced build | Exit 0; mandatory portal generators run successfully |
| Workspace Turbo typechecks | Exit 0 (packages with configured typecheck tasks) |
| MCP unit | 844 passed |
| MCP integration | 110 passed, 10 skipped, 0 failed |
| API unit | 526 passed |
| Portal | 71 passed |
| Notification service | 14 passed |
| Compiled MCP HTTP interface | 6 passed, including initialize, 184-tool discovery, catalog call, session-owner rejection, graceful shutdown |
| Discovery validator | Passed; all three generated artifacts are byte-identical across repeated generation |
| Portal built-output smoke | Passed on final output after dependency updates |
| Python portal HTTP serving | Landing, pricing, signup, server-card aliases, and agent card returned 200; dates matched canonical metrics |
| Chromium signup render | No page errors; screenshot `/tmp/quill-1058-signup.png` |
| Root workflow/secrets/hang regression tests | 14 passed |
| Workflow YAML validation | 32 files passed |
| Rust formatting | Passed |
| Rust Clippy, both library targets | Passed |
| Rust library tests | 8 search tests and 4 bench-generator tests passed |
| Existing stdio PR #1046 | 19 transport/guard/integration tests passed in `/home/j_kro/Work/quill-1046-verify`; no merge performed |

Logs: `/tmp/quill-1058-security-verification/`, `/tmp/quill-1058-rust-tests.log`, `/tmp/quill-1058-clippy.log`, `/tmp/quill-1046-tests.log`.

## Marketplace corrections

The mcprush public page now says `Publisher Verified`. No marketplace edit was submitted by this agent.

- Auth must say **Bearer API key required**, not `None — open`. Live unauthenticated `/sse` returns 401. Keep production auth enabled.
- Publish the 184-tool catalog after the hosted transport fix is deployed and authenticated introspection is verified.
- Version 0.4.0 matches package metadata, but the dispatcher still reports 0.1.0. Version unification is unfinished.
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

1. **Unpatched dependency:** `http-cache-semantics <=4.2.0`, GHSA-ch52-4w7c-c8xp / CVE-2026-93748. Audit remains nonzero. Astro uses it for remote-image build caching. The static portal runs under Python, not an Astro Node server; inspected Astro code constructs build requests rather than accepting client max-stale headers. This limits the observed production path but does not remove or patch the package. No audit suppression was added. See #1047.
2. **Live rollout:** local fixes are uncommitted and undeployed. Production API/MCP health return 200, MCP reports 184 tools, portal landing/signup/pricing/privacy/terms/status return 200. Authenticated live initialization and tools/call were not run with a customer key. No production signup, email, charge, or account mutation was made.
3. **Stdio release:** #1046 passes its focused tests but remains a separate open PR. Main still has the old bin behavior until it is integrated. npm publication was not attempted.
4. **Privacy/CASL/renewal:** #1038 preserves unfinished work in `Projects/quill-1038`. It has not been ported or approved. Sender postal/contact details, consent/suppression evidence, processor locations, policy accuracy, checkout adjacency, and qualified legal review remain required. Do not invent a mailing address or compliance certification.
5. **Credential history:** #854 and #1043 require confirmed rotation/re-encryption and revocation. Do not expose historical secret values. No credentials were rotated in this pass.
6. **Licensing:** #1044 requires an explicit rights-holder decision. Package and file notices still conflict with root declarations.
7. **Provenance:** #991 legacy evidence gaps and #986 build-revision evidence need their own acceptance checks; health endpoints do not establish evidence quality.
8. **CI:** the Rust workflow repair has not run on GitHub Actions. Existing hardening PR #1045 and other open PRs remain unmerged. The self-hosted execution security boundary must remain intact during review.
9. **Broader coverage:** all ingestion modules, AI providers, payment methods, OAuth/passkey/browser user journeys, retention jobs, disaster recovery, and the full workspace test command were not exhaustively verified. Ten integration skips remain explicitly reported.

## Boundaries

No push, merge, deployment, paid purchase, production account creation, credential rotation, or production-data mutation occurred. Existing worktrees and unfinished work were preserved. The read-only audit and local repairs do not establish legal compliance or complete production readiness.
