---
last-reviewed: 2026-07-07
status: partial
---

# Authentication

> **⚠️ PARTIALLY IMPLEMENTED**: Basic API key authentication exists. OAuth, Web3, and Passkey authentication are planned features. See ROADMAP.md Phase 6 for status.

MapleSpike supports multiple authentication methods. Choose the one that fits your use case.

## API Keys (Implemented) ✅

API keys are the primary authentication method. Pass them via the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://localhost:8082/v1/gov/search?q=housing&limit=5"
```

Or via the `X-API-Key` header:

```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  "http://localhost:8082/v1/gov/search?q=housing&limit=5"
```

### Key Management (Planned)

Manage your API keys via the `/v1/keys` endpoints:

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/v1/keys` | List all keys (returns label, prefix, createdAt) | Planned |
| POST | `/v1/keys` | Create a new API key | Planned |
| DELETE | `/v1/keys/:id` | Delete an API key | Planned |
| POST | `/v1/keys/:id/rotate` | Rotate (regenerate) an API key | Planned |

### Local Development Key

For local development, use:
```
QUILL_API_KEY=maplespike-dev-key
```

## JWT Authentication (Planned) 🚧

For session-based auth, MapleSpike will support JWT tokens issued via OAuth or GitHub login.

### GitHub OAuth (Planned)

```bash
# Step 1: Initiate GitHub login
curl http://localhost:8082/v1/auth/github

# Step 2: After GitHub callback, get JWT
# (handled by browser redirect)

# Step 3: Use the JWT token
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:8082/v1/me"

# Refresh token
curl -X POST http://localhost:8082/v1/auth/refresh \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Generic OAuth (Planned)

MapleSpike will support multiple OAuth providers. List available providers:

```bash
curl http://localhost:8082/v1/auth/oauth/providers
```

Initiate login for a specific provider:

```bash
curl http://localhost:8082/v1/auth/oauth/PROVIDER_NAME
```

## Web3 / Wallet Authentication (Planned) 🚧

Connect a cryptocurrency wallet (Ethereum, etc.) for authentication:

```bash
# Step 1: Request a challenge
curl -X POST http://localhost:8082/v1/auth/web3/challenge \
  -H "Content-Type: application/json" \
  -d '{"address": "0x1234..."}'

# Step 2: Sign the challenge with your wallet and send back
curl -X POST http://localhost:8082/v1/auth/web3/login \
  -H "Content-Type: application/json" \
  -d '{"address": "0x1234...", "signature": "0xabcd...", "message": "MapleSpike auth: ..."}'
```

## Passkey / WebAuthn Authentication (Planned) 🚧

For passwordless authentication using biometrics or hardware security keys:

```bash
# Step 1: Begin registration
curl -X POST http://localhost:8082/v1/auth/passkey/register/begin \
  -H "Content-Type: application/json" \
  -d '{"name": "My Passkey"}'

# Step 2: Complete registration with browser credential
curl -X POST http://localhost:8082/v1/auth/passkey/register/complete \
  -H "Content-Type: application/json" \
  -d '{"credential": {...}}'

# Login
curl -X POST http://localhost:8082/v1/auth/passkey/login/begin
curl -X POST http://localhost:8082/v1/auth/passkey/login/complete \
  -d '{"credential": {...}}'

# List registered credentials
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8082/v1/auth/passkey/credentials

# Delete a credential
curl -X DELETE http://localhost:8082/v1/auth/passkey/credentials/CRED_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Rate Limit Headers (Implemented) ✅

Every response includes rate limit information in headers:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 28
X-RateLimit-Reset: 1715700000
Retry-After: 45
```

## Public (Unauthenticated) Endpoints (Implemented) ✅

The following endpoints do not require authentication:

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/v1/health` | GET | Health check | ✅ Working |
| `/v1/openapi.json` | GET | OpenAPI specification | ✅ Working |
| `/v1/gov/search` | GET | Search government data | ✅ Working |
| `/v1/citation/:id` | GET | Citation verification | ✅ Working |
| `/v1/register` | POST | Create new account | Planned |
| `/v1/billing/plans` | GET | List billing plans | Planned |
| All `/v1/auth/*` routes | Various | Authentication flows | Planned |

Unauthenticated requests have stricter rate limits (5/min max).

## Implementation Status

### ✅ Implemented
- Basic API key authentication
- Rate limiting headers
- Public endpoint access

### 🚧 Planned (Phase 6)
- API key management UI/API
- JWT authentication
- GitHub OAuth
- Generic OAuth providers
- Web3 wallet authentication
- Passkey/WebAuthn support
- User registration flow

## Current Development Status

See ROADMAP.md Phase 6 for current authentication development status. Basic framework exists but advanced auth methods are not yet implemented.