# Proposal: Fix API CA bundle (issue #778)

## Problem
The running `quill-api` image (digest `sha256:3b2f6fc1...`) has **no usable CA
certificate bundle**, so Node's outbound TLS to `github.com` during the OAuth
token exchange fails with `unable to get local issuer certificate`. This surfaces
to the client as a **502** on the GitHub OAuth callback.

## Root cause
The image was Nix-built and the runtime layer did not expose a CA bundle that
Node could find. Node requires an explicit `NODE_EXTRA_CA_CERTS` (or a system
store it understands) to validate outbound HTTPS.

## Proposed fix
In `Dockerfile.api` (Debian `node:22-bookworm-slim` runtime):
1. Install `ca-certificates` (already present) and consolidate the bundle into a
   single stable file at `/usr/local/share/ca-certificates/ca-bundle.crt`.
2. Add a thin `entrypoint.sh` wrapper that exports
   `NODE_EXTRA_CA_CERTS="${CA_CERT_PATH:-/usr/local/share/ca-certificates/ca-bundle.crt}"`
   before exec'ing `node`.
3. Parameterize the path via `ENV CA_CERT_PATH=...` so it can be overridden at
   runtime without a rebuild. No hardcoded `/etc/nix/store` paths.

## Affected packages
- `packages/api-server` (only the Docker packaging / runtime, no source changes)

## Verification gate
- `node -e "fetch('https://api.github.com/user')"` inside the pod must print
  `GH 200` or `GH 401` (NOT `fetch failed`).
- `GET /v1/auth/oauth/github/callback?code=bogus&state=bogus` must no longer be a
  TLS 502.
- Running pod digest must differ from the broken `3b2f6fc1...` baseline.
