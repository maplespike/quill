## Context and decisions

MCP sends `POST {ASTRAL_KEY_URL}/api/v1/auth/verify` with `{token}`, plus `audience` and `required_scopes` when `ASTRAL_KEY_AUDIENCE` is set (`ASTRAL_KEY_SCOPES` is a comma-separated list). It strips trailing slashes from the base URL, uses a five-second timeout consistent with tenant-key verification, and accepts only HTTP success with boolean `valid: true`. Transport failures and malformed JSON fail closed for this verifier, while existing independent authentication methods remain available. No token caching is introduced.

Without `ASTRAL_KEY_AUDIENCE` the request is validity-only: it accepts any Astral access token, including a plain session JWT, which is not an authorization boundary. Setting an audience makes the check meaningful — Astral refuses a session JWT when an audience or scopes are requested, so only a capability token minted for this server passes.

## Security and limits

The Astral endpoint in existing releases accepts refresh tokens; release Astral Key's access-only fix (reverb256/astral-key#69) before this Quill change. After that fix the endpoint verifies access JWTs and Ed25519 capability tokens, and rejects refresh tokens. Audience and scope checks only apply to capability tokens: a session JWT cannot prove which resource it was issued for, so it is refused whenever an audience or scopes are requested. This change does not provide tenant isolation, revoke semantics, or end-to-end transport protection. Operators must secure the service connection and configure the correct trusted base URL. This sends the bearer to the configured verifier, with no new persistence or logging.

## Rollout and rollback

Deploy the access-only Astral endpoint first, verify it, then release the MCP change using normal review and deployment. Operators that set `ASTRAL_KEY_AUDIENCE` must issue capability tokens with the matching audience and scopes; existing session tokens will be rejected by design, so introduce the audience setting only alongside a minting flow. Revert the MCP image to roll back; that restores the incorrect endpoint behavior. No migration is required.
