## Why

The repository is being prepared to accept pull requests from outside this GitHub account. The self-hosted runners share a host home directory and can reach the cluster. The MCP stream accepted anonymous discovery. Chart probes did not cover every service with a cheap health path.

## What Changes

- Fork pull requests keep the `pull_request` trigger and run on GitHub-hosted runners. GitHub withholds secrets and supplies a read-only token. Same-repo pull requests and pushes stay on the self-hosted pool.
- `GET /sse`, `POST /messages`, and `POST /mcp` require an API key or an API session JWT. `GET /health` stays public.
- API, MCP, search, and portal probes use cheap health paths. API, MCP, and search gain a startupProbe. CI renders the chart and smokes the portal health path.

## Capabilities

### New Capabilities

- `public-fork-ci`: runner selection for untrusted pull requests
- `mcp-http-auth`: credential gate for SSE and streamable HTTP
- `chart-health-probes`: liveness, readiness, and startup probes

### Modified Capabilities

## Impact

- `.github/workflows/*`, `scripts/gates/check-fork-runner-policy.mjs`, `scripts/ci/refuse-untrusted-self-hosted.sh`
- `packages/quill-mcp` HTTP server and integration tests
- `charts/quill` probe templates, `packages/portal/server.py`, `scripts/test-chart-probes.mts`, `scripts/smoke-probe-endpoints.mjs`

No new dependency major. No change to the API health handler. No branch-protection change. CI does not commit as a user.
