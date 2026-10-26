## Decision

`pull_request` is removed. `pull_request_target` keeps the workflow file on the base branch. The `runs-on` expression sends a fork to `ubuntu-latest` and every other event to the existing self-hosted labels.

The inline refuse step runs before checkout. Checkout uses the pull request head SHA and `persist-credentials: false`. The next step clears `GITHUB_TOKEN` when the head repository is a fork. Hosted jobs install Node 22 and pnpm 10.32.1 only when `runner.environment == 'github-hosted'`.

A new workflow file in a fork is not visible to the in-repo gate. `scripts/ci/refuse-untrusted-self-hosted.sh` is the runner hook. The operator installs it. GitHub "Require approval for all outside collaborators" is an operator setting. This change does not edit branch protection.

Privileged jobs (`merge-when-green`, Dependabot auto-merge, the gitleaks licence step, image build) stay off fork runs. `merge-when-green` moves to `ubuntu-latest` and keeps the same-repo and actor gate. It still uses `GITHUB_TOKEN`. It does not set a human git identity.

MCP accepts the same credentials as the API: `X-API-Key`, `Authorization: Bearer` (API key or HS256 session JWT), and the session cookie. Astral and Casdoor remain. `GET /health` and `GET /` stay public. `OPTIONS` stays open for preflight. `POST /mcp` is stateless JSON-RPC. An authenticated `GET /mcp` returns 405.

Probes:

- API `GET /v1/health`, with startupProbe. The handler is unchanged.
- MCP `GET /health`, with startupProbe. `/sse` is authenticated, so it is not a probe.
- Search `GET /health`, with startupProbe, because the index opens before listen.
- Portal `GET /health`, no startupProbe. The route does not read the homepage.

## Rollback

Revert the workflow trigger change and the chart probe values. The MCP auth change is not safe to revert on a public repository.
