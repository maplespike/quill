
---
last-reviewed: 2026-05-19
status: active

||||||| e980c07
 origin/main
# Authentication

MapleSpike supports multiple authentication methods. Choose the one that fits your use case.

## API Keys (Recommended for Programmatic Access)

API keys are the primary authentication method. Pass them via the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://maplespike.lan/v1/gov/search?q=housing&limit=5"
```

Or via the `X-API-Key` header:

```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  "http://maplespike.lan/v1/gov/search?q=housing&limit=5"
```

### Key Management

Manage your API keys via the `/v1/keys` endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/keys` | List all keys (returns label, prefix, createdAt) |
| POST | `/v1/keys` | Create a new API key |
| DELETE | `/v1/keys/:id` | Delete an API key |
| POST | `/v1/keys/:id/rotate` | Rotate (regenerate) an API key |

```bash
# List keys
curl -H "Authorization: Bearer YOUR_API_KEY" "http://maplespike.lan/v1/keys"

# Create a new key
curl -X POST http://maplespike.lan/v1/keys \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label": "my-app-key"}'

# Delete a key
curl -X DELETE http://maplespike.lan/v1/keys/KEY_ID \
  -H "Authorization: Bearer YOUR_API_KEY"

# Rotate a key
curl -X POST http://maplespike.lan/v1/keys/KEY_ID/rotate \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Local Development Key

For local development, use:
```
MAPLESPIKE_API_KEY=maplespike-dev-key
```

## JWT Authentication

For session-based auth, MapleSpike supports JWT tokens issued via OAuth or GitHub login.

### GitHub OAuth

```bash
# Step 1: Initiate GitHub login
curl http://maplespike.lan/v1/auth/github

# Step 2: After GitHub callback, get JWT
# (handled by browser redirect)

# Step 3: Use the JWT token
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://maplespike.lan/v1/me"

# Refresh token
curl -X POST http://maplespike.lan/v1/auth/refresh \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Generic OAuth

MapleSpike supports multiple OAuth providers. List available providers:

```bash
curl http://maplespike.lan/v1/auth/oauth/providers
```

Initiate login for a specific provider:

```bash
curl http://maplespike.lan/v1/auth/oauth/PROVIDER_NAME
```

## Web3 / Wallet Authentication

Connect a cryptocurrency wallet (Ethereum, etc.) for authentication:

```bash
# Step 1: Request a challenge
curl -X POST http://maplespike.lan/v1/auth/web3/challenge \
  -H "Content-Type: application/json" \
  -d '{"address": "0x1234..."}'

# Step 2: Sign the challenge with your wallet and send back
curl -X POST http://maplespike.lan/v1/auth/web3/login \
  -H "Content-Type: application/json" \
  -d '{"address": "0x1234...", "signature": "0xabcd...", "message": "MapleSpike auth: ..."}'
```

## Passkey / WebAuthn Authentication

For passwordless authentication using biometrics or hardware security keys:

```bash
# Step 1: Begin registration
curl -X POST http://maplespike.lan/v1/auth/passkey/register/begin \
  -H "Content-Type: application/json" \
  -d '{"name": "My Passkey"}'

# Step 2: Complete registration with browser credential
curl -X POST http://maplespike.lan/v1/auth/passkey/register/complete \
  -H "Content-Type: application/json" \
  -d '{"credential": {...}}'

# Login
curl -X POST http://maplespike.lan/v1/auth/passkey/login/begin
curl -X POST http://maplespike.lan/v1/auth/passkey/login/complete \
  -d '{"credential": {...}}'

# List registered credentials
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://maplespike.lan/v1/auth/passkey/credentials

# Delete a credential
curl -X DELETE http://maplespike.lan/v1/auth/passkey/credentials/CRED_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Rate Limit Headers

Every response includes rate limit information in headers:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 28
X-RateLimit-Reset: 1715700000
Retry-After: 45
```

## Public (Unauthenticated) Endpoints

The following endpoints do not require authentication:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/health` | GET | Health check |
| `/v1/openapi.json` | GET | OpenAPI specification |
| `/v1/gov/search` | GET | Search government data |
| `/v1/citation/:id` | GET | Citation verification |
| `/v1/register` | POST | Create new account |
| `/v1/billing/plans` | GET | List billing plans |
| All `/v1/auth/*` routes | Various | Authentication flows |

Unauthenticated requests have stricter rate limits (5/min max).
