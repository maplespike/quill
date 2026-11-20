## Context and decisions

MCP sends `POST {ASTRAL_KEY_URL}/api/v1/auth/verify` with `{token}`. It strips trailing slashes from the base URL, uses a five-second timeout consistent with tenant-key verification, and accepts only HTTP success with boolean `valid: true`. Transport failures and malformed JSON fail closed for this verifier, while existing independent authentication methods remain available. No token caching is introduced.

## Security and limits

The Astral endpoint in existing releases accepts refresh tokens; release Astral Key's access-only fix (reverb256/astral-key#69) before this Quill change. The endpoint verifies JWT access tokens only, not Astral API keys or JIT tokens. It returns no audience or scopes and this change does not provide tenant isolation, revoke semantics, or end-to-end transport protection. Operators must secure the service connection and configure the correct trusted base URL. This sends the bearer to the configured verifier, with no new persistence or logging. Latency is not benchmarked.

## Rollout and rollback

Deploy the access-only Astral endpoint first, verify it, then release the MCP change using normal review and deployment. Revert the MCP image to roll back; that restores the incorrect endpoint behavior. No migration is required.
