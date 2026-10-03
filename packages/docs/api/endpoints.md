---
last-reviewed: 2026-07-07
status: active
---

# API Endpoints — Documented Routes

The MapleSpike REST API is served at `http://localhost:8082/v1/`. Routes share a response envelope, but payload, quality, and citation fields vary by endpoint and source. Check the live OpenAPI specification for the current route list.

## Base URL

```
http://localhost:8082/v1/
```

## Standard Response Envelope

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "requestId": "maplespike-abc123...",
    "timestamp": "2026-05-14T11:36:00Z",
    "version": "0.1.0",
    "usage": { "periodCalls": 5, "periodLimit": 1000, "tier": "free" },
    "creditsCharged": 0,
    "cacheStatus": "hit|miss",
    "durationMs": 42,
    "authMethod": "api-key|jwt|oauth|web3|passkey"
  },
  "quality": {
    "freshness_seconds": 3600,
    "source_uptime_7d": 0.98,
    "confidence": "high",
    "certainty_score": 0.95
  },
  "citation": {
    "source_name": "...",
    "source_url": "...",
    "retrieved_at": null,
    "data_hash": "sha256:<canonical-record-hash>",
    "license": "Publisher-provided metadata when supplied, or a notice to consult source terms",
    "license_basis": "publisher-metadata or no-publisher-declaration",
    "provenance_evidence": null,
    "update_frequency": "daily"
  }
}
```

## Endpoint Table

| Method | Endpoint | Auth | Credits | Description |
|--------|----------|------|---------|-------------|
| GET | `/v1/health` | No | 0 | Health check with usage stats |
| GET | `/v1/gov/search` | No | 1 | Search supported records from configured sources |
| GET | `/v1/gov/releases` | Yes | 1 | Latest government data releases |
| GET | `/v1/citation/:id` | No | 0 | Look up a canonical-record hash; a match checks integrity, not source authenticity |
| GET | `/v1/usage` | Yes | 0 | Current API usage and quota |
| POST | `/v1/ai_ask` | Yes | 1 | Natural language Q&A across datasets |
| POST | `/v1/ai/ask` | Yes | 1 | Alias for ai_ask |
| POST | `/v1/ai/analyze` | Yes | 1 | AI-powered document analysis |
| POST | `/v1/audit/query` | Yes | 1 | Query the audit log |
| GET | `/v1/signals` | Yes | 1 | Engine signals (lazy-loaded) |
| GET | `/v1/openapi.json` | No | 0 | OpenAPI specification |
| GET | `/v1/` | No | 0 | Root redirect to OpenAPI spec |

### Key Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/v1/keys` | Yes | List all API keys |
| POST | `/v1/keys` | Yes | Create a new API key |
| DELETE | `/v1/keys/:id` | Yes | Delete an API key |
| POST | `/v1/keys/:id/rotate` | Yes | Rotate (regenerate) an API key |

### Account

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/v1/register` | No | Create a new account |
| GET | `/v1/me` | Yes | Get current account details |

### Billing

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/v1/billing/plans` | No | List all billing plans |
| POST | `/v1/billing/checkout` | Yes | Create a checkout session |

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/v1/auth/oauth/providers` | No | List OAuth providers |
| GET | `/v1/auth/oauth/:provider` | No | Initiate OAuth login |
| GET | `/v1/auth/oauth/:provider/callback` | No | OAuth callback |
| GET | `/v1/auth/github` | No | Initiate GitHub login |
| GET | `/v1/auth/github/callback` | No | GitHub callback |
| POST | `/v1/auth/refresh` | No | Refresh JWT token |
| POST | `/v1/auth/logout` | No | Logout and invalidate session |
| GET | `/v1/auth/me` | Yes | Get current auth user |
| POST | `/v1/auth/web3/challenge` | No | Request Web3 auth challenge |
| POST | `/v1/auth/web3/login` | No | Complete Web3 login |
| POST | `/v1/auth/passkey/register/begin` | No | Begin passkey registration |
| POST | `/v1/auth/passkey/register/complete` | No | Complete passkey registration |
| POST | `/v1/auth/passkey/login/begin` | No | Begin passkey login |
| POST | `/v1/auth/passkey/login/complete` | No | Complete passkey login |
| GET | `/v1/auth/passkey/credentials` | Yes | List registered passkeys |
| DELETE | `/v1/auth/passkey/credentials/:id` | Yes | Delete a passkey |

### Query Parameters (All GET Endpoints)

| Parameter | Type | Description |
|-----------|------|-------------|
| `_mock` | boolean | Return mock data for testing |
| `_fields` | string | Comma-separated list of fields to include |
| `_format` | string | Response format (`compact`, `full`) |
| `_limit` | number | Maximum results to return |
| `_ttl` | number | Cache TTL override in seconds |

## Token Optimization

Use `_fields` to reduce response size and save tokens:

```bash
curl "http://localhost:8082/v1/gov/search?q=GDP&_fields=title,summary,url"
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Route not found |
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `RATE_LIMITED` | 429 | Too many requests |
| `QUOTA_EXHAUSTED` | 402 | Monthly quota reached (free tier) |
| `VALIDATION_ERROR` | 400 | Invalid parameters |
| `HEALTH_CHECK_FAILED` | 500 | Health check failure |
| `NOT_AVAILABLE` | 503 | Feature not available |
