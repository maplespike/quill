---
last-reviewed: 2026-07-07
status: active
---

# GET /v1/health

Check service health and get current usage statistics. This is the only endpoint that does not consume a credit.

## Request

```bash
curl http://localhost:8082/v1/health
```

No authentication required. No query parameters needed.

## Response

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "MapleSpike API",
    "version": "0.1.0",
    "environment": "production",
    "tenant": {
      "id": "tenant-abc123",
      "name": "My Account",
      "tier": "free"
    },
    "usage": {
      "daily": 5,
      "monthly": 15
    },
    "timestamp": "2026-05-14T11:36:00Z"
  },
  "meta": {
    "requestId": "maplespike-abc123...",
    "timestamp": "2026-05-14T11:36:00Z",
    "version": "0.1.0",
    "usage": { "periodCalls": 0, "periodLimit": 1000, "tier": "free" },
    "creditsCharged": 0,
    "cacheStatus": "miss",
    "durationMs": 12
  },
  "quality": {
    "freshness_seconds": 12,
    "source_uptime_7d": 0.98,
    "confidence": "high",
    "certainty_score": 1.0
  },
  "citation": {
    "source_name": "MapleSpike API",
    "source_url": "http://localhost",
    "retrieved_at": null,
    "data_hash": "",
    "license": "The publisher license was not declared in the metadata returned to Quill. Consult the publisher's terms.",
    "license_basis": "no-publisher-declaration",
    "update_frequency": "daily",
    "provenance_evidence": null
  }
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `"ok"` if healthy |
| `service` | string | Service name |
| `version` | string | API version |
| `environment` | string | Deployment environment |
| `tenant.id` | string | Your tenant ID |
| `tenant.name` | string | Your account name |
| `tenant.tier` | string | Your tier (free/pro/business/enterprise) |
| `usage.daily` | number | API calls today |
| `usage.monthly` | number | API calls this month |
| `timestamp` | string | ISO 8601 timestamp |

## Error Response

```json
{
  "success": false,
  "error": {
    "code": "HEALTH_CHECK_FAILED",
    "message": "Database connection failed"
  }
}
```
