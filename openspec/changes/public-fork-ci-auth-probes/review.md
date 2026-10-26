## Review

- Fork code is not scheduled on `[self-hosted, nixos]`.
- A fork `pull_request` cannot reach a self-hosted runner. `pull_request_target` does not check out pull request code. GitHub withholds secrets from a fork pull request.
- `ci-doctor` passes workflow metadata through the environment and rejects newlines before `GITHUB_ENV`.
- The runner hook is documented as an operator install. This change does not claim it is active on nexus or forge.
- MCP tests cover a missing credential, a bad credential, and a valid API key and JWT.
- Probe paths are asserted from `helm template`, not from a text search of the template source.
- No major version bump. The API `/v1/health` response contract is unchanged.

## Verdict

Proceed. Do not loosen branch protection. Do not add a job that commits as a user.
